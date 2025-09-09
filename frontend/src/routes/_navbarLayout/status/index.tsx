import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPSlot, InputOTPGroup, InputOTPSeparator } from '@/components/ui/input-otp';
import { ProductPicker } from '@/components/custom/productPicker';
import axios from "axios"

export const Route = createFileRoute('/_navbarLayout/status/')({
  component: RouteComponent,
});

function RouteComponent() {
  const [statusCard, setStatusCard] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pump, setPump] = useState('');
  const [grade, setGrade] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true); // Disable button and show loading

    const payload = {
      statusCardNumber: statusCard,
      name,
      phone,
      pump,
      fuelGrade: grade,
      amount,
      total,
      notes,
      stationName: localStorage.getItem('location'),
    };

    try {
      const response = await axios.post('/api/status-sales', payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.status === 200 || response.status === 201) {
        const data = response.data;
        console.log('Status sale created successfully:', data);
        alert('Status sale created successfully!');
        navigate({ to: '/status/list' })
      } else {
        const errorData = response.data;
        console.error('Error creating status sale:', errorData);
        alert(`Error: ${errorData.error || 'Failed to create status sale'}`);
      }
    } catch (error: any) {
      console.error('Error creating status sale:', error);
      alert('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false); // Re-enable button
    }
  };

  const handleBlur = async () => {
    // Automatically populate Name and Phone based on Status Card
    if (statusCard.length === 10) {
      try {
        // add authorization header with bearer token
        const response = await axios.get(`/api/status-sales/${statusCard}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.status === 200) {
          const userData = response.data;
          setName(userData.name || '');
          setPhone(userData.phone || '');
        } else {
          setName('');
          setPhone('');
        }
      } catch (error) {
        setName('');
        setPhone('');
      }
    } else {
      // Clear Name and Phone if Status Card is not valid
      setName('');
      setPhone('');
    }
  };

  return (
    <div className="flex items-center justify-center">
      <div className="max-w-md w-full p-4 border border-dashed border-gray-300 rounded-md space-y-4">
        <h2 className="text-lg font-bold">Status Sales Form</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status Card Number */}
          <div>
            <label htmlFor="statusCard" className="block text-sm font-medium text-gray-700">
              Status Card Number
            </label>
            <InputOTP
              maxLength={10}
              name="statusCardNumber"
              onChange={(value) => setStatusCard(value)}
              required
              onBlur={handleBlur}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={5} />
                <InputOTPSlot index={6} />
                <InputOTPSlot index={7} />
                <InputOTPSlot index={8} />
                <InputOTPSlot index={9} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              required={Number(amount) >= 200} // Require phone number if amount is less than 200 litres
            />
          </div>

          {/* Pump */}
          <div>
            <label htmlFor="pump" className="block text-sm font-medium text-gray-700">
              Pump
            </label>
            <Input
              id="pump"
              type="text"
              value={pump}
              onChange={(e) => setPump(e.target.value)}
              placeholder="Enter pump number"
              required
            />
          </div>

          {/* Grade */}
          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-gray-700">
              Fuel Grade
            </label>
            <ProductPicker setProduct={setGrade} />
          </div>

          {/* Amount (in litres) */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
              Amount (in litres)
            </label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount in litres"
              required
            />
          </div>

          {/* Total (in CAD) */}
          <div>
            <label htmlFor="total" className="block text-sm font-medium text-gray-700">
              Total (in CAD)
            </label>
            <Input
              id="total"
              type="number"
              step="0.01"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="Enter total in CAD"
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any additional notes"
              className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm p-2"
              rows={4} // Adjust the number of rows as needed
              required={Number(amount) >= 200} // Require notes if amount is less than 200 litres
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
}
