// import { useState } from 'react'
// import { Button } from '@/components/ui/button'
// import { Input } from '@/components/ui/input'
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from '@/components/ui/dialog'

// interface PasswordProtectionProps {
//   isOpen: boolean
//   onSuccess: () => void
//   onCancel: () => void
// }

// export function PasswordProtection({ isOpen, onSuccess, onCancel }: PasswordProtectionProps) {
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState('')

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
    
//     if (password === '1911') {
//       // Store password verification in sessionStorage (clears on browser close)
//       sessionStorage.setItem('inventory_access', 'true')
//       setError('')
//       setPassword('')
//       onSuccess()
//     } else {
//       setError('Incorrect password')
//       setPassword('')
//     }
//   }

//   const handleCancel = () => {
//     setPassword('')
//     setError('')
//     onCancel()
//   }

//   return (
//     <Dialog open={isOpen} onOpenChange={handleCancel}>
//       <DialogContent className="sm:max-w-[425px]">
//         <DialogHeader>
//           <DialogTitle>Access Required</DialogTitle>
//           <DialogDescription>
//             Please enter the password to access the Inventory page.
//           </DialogDescription>
//         </DialogHeader>
//         <form onSubmit={handleSubmit} autoComplete='off'>
//           <div className="grid gap-4 py-4">
//             <Input
//               type="password"
//               name="access-password"
//               placeholder="Enter password"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               autoFocus
//               autoComplete="new-password"
//             />
//             {error && <p className="text-sm text-red-500">{error}</p>}
//           </div>
//           <DialogFooter>
//             <Button type="button" variant="outline" onClick={handleCancel}>
//               Cancel
//             </Button>
//             <Button type="submit">Submit</Button>
//           </DialogFooter>
//         </form>
//       </DialogContent>
//     </Dialog>
//   )
// }
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
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface PasswordProtectionProps {
  isOpen: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PasswordProtection({
  isOpen,
  onSuccess,
  onCancel,
}: PasswordProtectionProps) {
  const [otp, setOtp] = useState(""); // controlled OTP string
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (otp === "1911") {
      // sessionStorage.setItem("inventory_access", "true");
      sessionStorage.setItem("dashboard_access", "true");
      setOtp("");
      setError("");
      onSuccess();
    } else {
      setOtp("");
      setError("Incorrect code");
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
            Please enter the 4-digit code to access the Inventory page.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="grid gap-4 py-4">
            <div className="flex justify-center">
              <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Submit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}