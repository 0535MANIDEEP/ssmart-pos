const prisma = require('../lib/prisma');
const { postJournal, nextVoucherNumber, findLedgerByPurpose, findPaymentLedger } = require('../lib/accounting');

async function findOrCreateCustomerLedger(customerName, debtorGroupId) {
  const name = (customerName || 'Walk-in Customer').trim();
  let ledger = await prisma.ledger.findFirst({
    where: { groupId: debtorGroupId, name },
  });
  if (!ledger) {
    ledger = await prisma.ledger.create({
      data: { name, groupId: debtorGroupId, linkedEntityType: 'customer', purpose: 'receivable' },
    });
  }
  return ledger;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function journalFromInvoice(invoice) {
  try {
    const {
      id, invoiceNumber, customerName, subtotal, discountAmount, taxAmount,
      totalAmount, paymentMethod, amountPaid, previousDuePaid,
      returnValue, creditApplied, refundValue,
    } = invoice;

    const effectiveSubtotal = round2(subtotal || 0);
    const effectiveDiscount = round2(discountAmount || 0);
    const effectiveTax = round2(taxAmount || 0);
    const effectiveTotal = round2(totalAmount || 0);
    const effectivePreviousDuePaid = round2(previousDuePaid || 0);
    const effectiveReturnValue = round2(returnValue || 0);
    const effectiveCreditApplied = round2(creditApplied || 0);
    const effectiveRefundValue = round2(refundValue || 0);

    const cgstAmount = round2(effectiveTax / 2);
    const sgstAmount = round2(effectiveTax - cgstAmount);

    const salesLedger = await findLedgerByPurpose('sales');
    if (!salesLedger) return;

    const cgstLedger = await findLedgerByPurpose('gst_output_cgst');
    const sgstLedger = await findLedgerByPurpose('gst_output_sgst');

    const cashBankLedger = await findPaymentLedger(paymentMethod);

    const debtorGroup = await prisma.accountGroup.findUnique({ where: { code: '1.1.3' } });
    let debtorLedger = null;
    if (debtorGroup && customerName) {
      debtorLedger = await findOrCreateCustomerLedger(customerName, debtorGroup.id);
    }

    const lines = [];
    const narrationParts = [`Sale ${invoiceNumber}`];

    if (paymentMethod === 'CREDIT') {
      if (debtorLedger && effectiveTotal > 0) {
        lines.push({ ledgerId: debtorLedger.id, debit: effectiveTotal, credit: 0 });
      }
    } else {
      if (cashBankLedger && effectiveTotal > 0) {
        lines.push({ ledgerId: cashBankLedger.id, debit: effectiveTotal, credit: 0 });
      }
    }

    if (effectiveTotal > 0 || effectiveReturnValue > 0) {
      const salesCredit = round2(effectiveTotal - effectiveTax);
      if (salesCredit > 0) {
        lines.push({ ledgerId: salesLedger.id, debit: 0, credit: salesCredit });
      }
    }

    if (cgstAmount > 0 && cgstLedger) {
      lines.push({ ledgerId: cgstLedger.id, debit: 0, credit: cgstAmount, taxType: 'CGST', taxAmount: cgstAmount });
    }
    if (sgstAmount > 0 && sgstLedger) {
      lines.push({ ledgerId: sgstLedger.id, debit: 0, credit: sgstAmount, taxType: 'SGST', taxAmount: sgstAmount });
    }

    if (lines.length >= 2) {
      await postJournal({
        date: new Date(),
        type: 'sales',
        referenceType: 'invoice',
        referenceId: id,
        narration: narrationParts.join(' | '),
        lines,
      });
    }

    if (effectivePreviousDuePaid > 0 && debtorLedger) {
      const dueCollectionLedger = cashBankLedger || (await findLedgerByPurpose('cash'));
      if (dueCollectionLedger) {
        await postJournal({
          date: new Date(),
          type: 'receipt',
          referenceType: 'invoice',
          referenceId: id,
          narration: `Due collection against ${invoiceNumber}`,
          lines: [
            { ledgerId: dueCollectionLedger.id, debit: effectivePreviousDuePaid, credit: 0 },
            { ledgerId: debtorLedger.id, debit: 0, credit: effectivePreviousDuePaid },
          ],
        });
      }
    }

    if (effectiveReturnValue > 0) {
      const returnLines = [];
      returnLines.push({ ledgerId: salesLedger.id, debit: effectiveReturnValue, credit: 0 });

      if (paymentMethod === 'CREDIT' && debtorLedger) {
        returnLines.push({ ledgerId: debtorLedger.id, debit: 0, credit: effectiveReturnValue });
      } else {
        const refundLedger = cashBankLedger || (await findLedgerByPurpose('cash'));
        if (refundLedger) {
          returnLines.push({ ledgerId: refundLedger.id, debit: 0, credit: effectiveReturnValue });
        }
      }

      if (returnLines.length >= 2) {
        await postJournal({
          date: new Date(),
          type: 'credit_note',
          referenceType: 'invoice',
          referenceId: id,
          narration: `Return on ${invoiceNumber}`,
          lines: returnLines,
        });
      }
    }

    if (effectiveCreditApplied > 0 && debtorLedger) {
      await postJournal({
        date: new Date(),
        type: 'payment',
        referenceType: 'invoice',
        referenceId: id,
        narration: `Credit applied on ${invoiceNumber}`,
        lines: [
          { ledgerId: debtorLedger.id, debit: effectiveCreditApplied, credit: 0 },
          { ledgerId: salesLedger.id, debit: 0, credit: effectiveCreditApplied },
        ],
      });
    }

    if (effectiveRefundValue > 0) {
      const refundLines = [];
      const refundLedger = cashBankLedger || (await findLedgerByPurpose('cash'));
      if (refundLedger) {
        refundLines.push({ ledgerId: refundLedger.id, debit: 0, credit: effectiveRefundValue });
      }
      if (paymentMethod === 'CREDIT' && debtorLedger) {
        refundLines.push({ ledgerId: debtorLedger.id, debit: 0, credit: effectiveRefundValue });
      } else {
        refundLines.push({ ledgerId: salesLedger.id, debit: effectiveRefundValue, credit: 0 });
      }

      if (refundLines.length >= 2) {
        await postJournal({
          date: new Date(),
          type: 'credit_note',
          referenceType: 'invoice',
          referenceId: id,
          narration: `Refund on ${invoiceNumber}`,
          lines: refundLines,
        });
      }
    }
  } catch (err) {
    console.error('[auto-journal] Failed to create invoice journal:', err.message);
  }
}

async function journalFromExpense(expense) {
  try {
    const { id, ledgerId, amount, paymentMode, bankLedgerId } = expense;

    const effectiveAmount = round2(amount || 0);
    if (effectiveAmount <= 0) return;

    const expenseLedger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!expenseLedger) return;

    let creditLedger = null;
    if (paymentMode === 'cash') {
      creditLedger = await findLedgerByPurpose('cash');
    } else if (bankLedgerId) {
      creditLedger = await prisma.ledger.findUnique({ where: { id: bankLedgerId } });
    }
    if (!creditLedger) {
      creditLedger = await findLedgerByPurpose('cash');
    }
    if (!creditLedger) return;

    await postJournal({
      date: new Date(),
      type: 'payment',
      referenceType: 'expense',
      referenceId: id,
      narration: `Expense: ${expenseLedger.name}`,
      lines: [
        { ledgerId: expenseLedger.id, debit: effectiveAmount, credit: 0 },
        { ledgerId: creditLedger.id, debit: 0, credit: effectiveAmount },
      ],
    });
  } catch (err) {
    console.error('[auto-journal] Failed to create expense journal:', err.message);
  }
}

module.exports = { journalFromInvoice, journalFromExpense };
