using System;
using System.Drawing;
using System.Linq;
using System.Net.Http;
using System.Windows.Forms;

namespace SSMartPos;

public class TrayManager : IDisposable
{
    private readonly NotifyIcon _trayIcon;
    private readonly MainForm _mainForm;

    public TrayManager(MainForm mainForm)
    {
        _mainForm = mainForm;

        _trayIcon = new NotifyIcon
        {
            Icon = LoadTrayIcon(),
            Text = "SS Mart POS",
            Visible = true
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add("Open SS Mart", null, (s, e) => ShowMainForm());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("New Sale (F11)", null, (s, e) => _mainForm.NavigateTo("/pos"));
        menu.Items.Add("Dashboard (Ctrl+D)", null, (s, e) => _mainForm.NavigateTo("/dashboard"));
        menu.Items.Add("Inventory", null, (s, e) => _mainForm.NavigateTo("/inventory"));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Backup Database", null, async (s, e) => await TriggerBackup());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Exit", null, (s, e) => _mainForm.ForceQuit());

        _trayIcon.ContextMenuStrip = menu;
        _trayIcon.DoubleClick += (s, e) => ShowMainForm();
    }

    private void ShowMainForm()
    {
        _mainForm.Show();
        _mainForm.WindowState = FormWindowState.Normal;
        _mainForm.BringToFront();
        _mainForm.Focus();
    }

    public void ShowBalloon(string message)
    {
        _trayIcon.ShowBalloonTip(2000, "SS Mart POS", message, ToolTipIcon.Info);
    }

    private async System.Threading.Tasks.Task TriggerBackup()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            var response = await client.PostAsync("http://localhost:4000/api/backup/run", null);
            if (response.IsSuccessStatusCode)
                ShowBalloon("Database backup created successfully.");
            else
                ShowBalloon("Backup failed. Is the backend running?");
        }
        catch
        {
            ShowBalloon("Backup failed. Is the backend running?");
        }
    }

    private static Icon LoadTrayIcon()
    {
        try
        {
            var assembly = System.Reflection.Assembly.GetExecutingAssembly();
            var resourceName = assembly.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("icon.ico"));
            if (resourceName != null)
                return new Icon(assembly.GetManifestResourceStream(resourceName)!);
        }
        catch { }
        return SystemIcons.Application;
    }

    public void Dispose()
    {
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
    }
}
