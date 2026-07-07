<#
.SYNOPSIS
  Enable and configure native OpenSSH Server on Windows for remote job
  dispatch from the Arch host.

.NOTES
  Run from an elevated PowerShell prompt on the worker node.
#>

# 1. Install the OpenSSH Server capability (built into modern Windows, not
#    installed by default).
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# 2. Start sshd and set it to start automatically on boot.
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

# 3. Open the firewall for inbound SSH (port 22) if the rule wasn't already
#    created by the capability install.
if (-not (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -DisplayName "OpenSSH Server (sshd)" `
        -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
}

# 4. (Recommended) Set PowerShell as the default shell for SSH sessions so
#    remote dispatch scripts can run .ps1 files directly.
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
    -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -PropertyType String -Force

# 5. Confirm the service is listening.
Get-Service sshd
Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP"

Write-Host "OpenSSH Server enabled. Next: copy your Arch host's public key into"
Write-Host "C:\Users\<worker-user>\.ssh\authorized_keys for key-based login."
