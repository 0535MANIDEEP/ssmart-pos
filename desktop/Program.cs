using System;
using System.Threading;
using System.Windows.Forms;

namespace SSMartPos;

static class Program
{
    private static Mutex? _mutex;

    [STAThread]
    static void Main()
    {
        const string appName = "SSMartPOS_SingleInstance_{8F3A2B1C-4D5E-6F7A-8B9C-0D1E2F3A4B5C}";
        _mutex = new Mutex(true, appName, out bool createdNew);

        if (!createdNew)
        {
            MessageBox.Show(
                "SS Mart is already running.\nCheck your system tray.",
                "SS Mart POS",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);

        Application.ThreadException += (s, e) =>
        {
            MessageBox.Show(
                $"An unexpected error occurred:\n\n{e.Exception.Message}",
                "SS Mart POS — Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        };

        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            var ex = e.ExceptionObject as Exception;
            MessageBox.Show(
                $"A critical error occurred:\n\n{ex?.Message}",
                "SS Mart POS — Critical Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        };

        Application.Run(new MainForm());
        GC.KeepAlive(_mutex);
    }
}
