import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, KeyRound } from "lucide-react"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPHiddenSlot,
} from "@/components/custom/input-otp-masked";
import axios from "axios"
import { useAuth } from "@/context/AuthContext" // Assuming your context path

export const Route = createFileRoute('/_navbarLayout/reset-password')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth(); // Get logged in user email
  const [isStoreAccount, setIsStoreAccount] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identify the account type on load
  useEffect(() => {
    const checkType = async () => {
      try {
        const res = await axios.post("/api/auth/identify", { email: user?.email });
        setIsStoreAccount(res.data.inStoreAccount);
      } catch (err) {
        setIsStoreAccount(true); // Default fallback for security
      }
    };
    if (user?.email) checkType();
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return setError("New passwords do not match");

    setLoading(true);
    setError(null);

    try {
      await axios.post("/api/auth/change-password-self", {
        currentPassword,
        newPassword
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, "X-Required-Permission": "passwordReset" }
      });
      alert("Password updated successfully!");
      // The socket will trigger force-logout, so we don't need to navigate
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update credentials");
    } finally {
      setLoading(false);
    }
  };

  if (isStoreAccount === null) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-slate-50/50">
      <div className="max-w-md w-full p-8 bg-white border rounded-xl shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Security Settings</h2>
          <p className="text-sm text-muted-foreground">
            Update your {isStoreAccount ? "6-digit passcode" : "account password"}
          </p>

        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {/* CURRENT CREDENTIALS */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Current {isStoreAccount ? "Passcode" : "Password"}</label>
            {/* Subtle help link */}
            <span className="pl-2 text-[11px] text-muted-foreground italic">
              Forgot? Contact Admin
            </span>
            {isStoreAccount ? (
              <InputOTP
                maxLength={6}
                value={currentPassword}
                onChange={setCurrentPassword}
                inputMode="numeric"
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, i) => <InputOTPHiddenSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            )}
          </div>

          <hr className="my-4" />

          {/* NEW CREDENTIALS */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New {isStoreAccount ? "Passcode" : "Password"}</label>
            {isStoreAccount ? (
              <InputOTP
                maxLength={6}
                value={newPassword}
                onChange={setNewPassword}
                inputMode="numeric"
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, i) => <InputOTPHiddenSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            ) : (
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            )}
          </div>

          {!isStoreAccount && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          )}

          {/* For Store accounts, confirm is just a second OTP field */}
          {isStoreAccount && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Passcode</label>
              <InputOTP
                maxLength={6}
                value={confirmPassword}
                onChange={setConfirmPassword}
                inputMode="numeric"
              >
                <InputOTPGroup>
                  {[...Array(6)].map((_, i) => <InputOTPHiddenSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Update Credentials
          </Button>
        </form>
      </div>
    </div>
  )
}