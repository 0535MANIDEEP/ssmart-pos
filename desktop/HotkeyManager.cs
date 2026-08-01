using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SSMartPos;

public class HotkeyManager : NativeWindow
{
    private readonly MainForm _mainForm;
    private const int WM_HOTKEY = 0x0312;

    private const int HOTKEY_NEW_SALE = 1;
    private const int HOTKEY_DASHBOARD = 2;
    private const int HOTKEY_SHOW = 3;

    [DllImport("user32.dll")]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, Keys vk);

    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    public HotkeyManager(MainForm form)
    {
        _mainForm = form;
        AssignHandle(form.Handle);
    }

    public void Register()
    {
        RegisterHotKey(Handle, HOTKEY_NEW_SALE, 0, Keys.F11);
        RegisterHotKey(Handle, HOTKEY_DASHBOARD, 2, Keys.D);
        RegisterHotKey(Handle, HOTKEY_SHOW, 2 | 1, Keys.S);
    }

    public void Unregister()
    {
        UnregisterHotKey(Handle, HOTKEY_NEW_SALE);
        UnregisterHotKey(Handle, HOTKEY_DASHBOARD);
        UnregisterHotKey(Handle, HOTKEY_SHOW);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_HOTKEY)
        {
            switch (m.WParam.ToInt32())
            {
                case HOTKEY_NEW_SALE:
                    _mainForm.NavigateTo("/pos");
                    _mainForm.Show();
                    _mainForm.WindowState = FormWindowState.Normal;
                    _mainForm.BringToFront();
                    break;
                case HOTKEY_DASHBOARD:
                    _mainForm.NavigateTo("/dashboard");
                    _mainForm.Show();
                    _mainForm.WindowState = FormWindowState.Normal;
                    _mainForm.BringToFront();
                    break;
                case HOTKEY_SHOW:
                    _mainForm.Show();
                    _mainForm.WindowState = FormWindowState.Normal;
                    _mainForm.BringToFront();
                    _mainForm.Focus();
                    break;
            }
        }
        base.WndProc(ref m);
    }
}
