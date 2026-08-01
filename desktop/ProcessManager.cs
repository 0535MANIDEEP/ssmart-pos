using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading.Tasks;

namespace SSMartPos;

public class ProcessManager
{
    private Process? _backendProcess;
    private Process? _frontendProcess;

    private readonly string _appRoot;
    private readonly string _nodePath;
    private readonly string _backendPath;
    private readonly string _frontendPath;

    public ProcessManager()
    {
        _appRoot = Path.GetDirectoryName(
            System.Reflection.Assembly.GetExecutingAssembly().Location)!;

        // Use embedded node.exe if present, otherwise system node
        var embeddedNode = Path.Combine(_appRoot, "node-runtime", "node.exe");
        _nodePath = File.Exists(embeddedNode) ? embeddedNode : "node";

        _backendPath = Path.Combine(_appRoot, "backend");
        _frontendPath = Path.Combine(_appRoot, "frontend");
    }

    public void StartBackend()
    {
        var serverFile = Path.Combine(_backendPath, "src", "server.js");

        _backendProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _nodePath,
                Arguments = $"\"{serverFile}\"",
                WorkingDirectory = _backendPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            }
        };
        _backendProcess.StartInfo.EnvironmentVariables["NODE_ENV"] = "production";
        _backendProcess.StartInfo.EnvironmentVariables["PORT"] = "4000";

        _backendProcess.OutputDataReceived += (s, e) =>
        {
            if (e.Data != null) Debug.WriteLine($"[Backend] {e.Data}");
        };
        _backendProcess.ErrorDataReceived += (s, e) =>
        {
            if (e.Data != null) Debug.WriteLine($"[Backend ERR] {e.Data}");
        };

        _backendProcess.Start();
        _backendProcess.BeginOutputReadLine();
        _backendProcess.BeginErrorReadLine();
    }

    public void StartFrontend()
    {
        var nextBin = Path.Combine(_frontendPath, "node_modules", ".bin", "next.cmd");

        // If .bin/next.cmd doesn't exist, try npx
        var useNpx = !File.Exists(nextBin);

        _frontendProcess = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _nodePath,
                Arguments = useNpx
                    ? $"npx next start -p {FRONTEND_PORT}"
                    : $"\"{nextBin}\" start -p {FRONTEND_PORT}",
                WorkingDirectory = _frontendPath,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            }
        };
        _frontendProcess.StartInfo.EnvironmentVariables["NODE_ENV"] = "production";

        _frontendProcess.OutputDataReceived += (s, e) =>
        {
            if (e.Data != null) Debug.WriteLine($"[Frontend] {e.Data}");
        };
        _frontendProcess.ErrorDataReceived += (s, e) =>
        {
            if (e.Data != null) Debug.WriteLine($"[Frontend ERR] {e.Data}");
        };

        _frontendProcess.Start();
        _frontendProcess.BeginOutputReadLine();
        _frontendProcess.BeginErrorReadLine();
    }

    public async Task<bool> WaitForPort(int port, int timeoutMs)
    {
        var start = DateTime.UtcNow;
        while ((DateTime.UtcNow - start).TotalMilliseconds < timeoutMs)
        {
            try
            {
                using var client = new TcpClient();
                await client.ConnectAsync("127.0.0.1", port);
                return true;
            }
            catch
            {
                await Task.Delay(500);
            }
        }
        return false;
    }

    public void KillExistingProcesses(int backendPort, int frontendPort)
    {
        KillProcessOnPort(backendPort);
        KillProcessOnPort(frontendPort);
    }

    private static void KillProcessOnPort(int port)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c for /f \"tokens=5\" %a in ('netstat -aon " +
                    $"^| findstr \":{port}\" " +
                    $"^| findstr \"LISTENING\" 2^>nul') " +
                    $"do taskkill /PID %a /F /T",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            Process.Start(psi)?.WaitForExit(3000);
        }
        catch { }
    }

    public void KillAll()
    {
        TryKill(_backendProcess);
        TryKill(_frontendProcess);
    }

    private static void TryKill(Process? p)
    {
        try
        {
            if (p != null && !p.HasExited)
            {
                p.Kill(entireProcessTree: true);
                p.WaitForExit(3000);
            }
        }
        catch { }
    }
}
