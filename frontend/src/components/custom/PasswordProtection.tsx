import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPHiddenSlot,
} from "@/components/custom/input-otp-masked";

interface PasswordProtectionProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
  userLocation: string; // new prop
}

export function PasswordProtection({
  isOpen,
  onSuccess,
  onCancel,
  userLocation,
}: PasswordProtectionProps) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/locations/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: userLocation, code: otp }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setOtp("");
        onSuccess();
      } else {
        setError(data.error || "Incorrect code");
        setOtp("");
      }
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setOtp("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Access Required</DialogTitle>
          <DialogDescription>
            Please enter the 4-digit manager code for your site.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="grid gap-4 py-4">
            <div className="flex justify-center">
              <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPHiddenSlot index={0} />
                  <InputOTPHiddenSlot index={1} />
                  <InputOTPHiddenSlot index={2} />
                  <InputOTPHiddenSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || otp.length !== 4}>
              {loading ? "Verifying..." : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}