import { Button } from '@/components/ui/button';
import { uploadBase64Image } from '@/lib/utils';
import { useFormStore } from '@/store';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import SignatureCanvas from 'react-signature-canvas';
import { domain } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import axios from "axios"
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/po/signature')({
  component: RouteComponent,
})

function RouteComponent() {
  const { user } = useAuth()
  const navigate = useNavigate();
  const signature = useFormStore((state) => state.signature);
  const setSignature = useFormStore((state) => state.setSignature);
  const signatureRef = useRef<SignatureCanvas>(null);

  const fleetCardNumber = useFormStore((state) => state.fleetCardNumber);
  const poNumber = useFormStore((state) => state.poNumber);
  const customerName = useFormStore((state) => state.customerName);
  const driverName = useFormStore((state) => state.driverName);
  const vehicleInfo = useFormStore((state) => state.vehicleInfo);
  const quantity = useFormStore((state) => state.quantity);
  const amount = useFormStore((state) => state.amount);
  const fuelType = useFormStore((state) => state.fuelType);
  const receipt = useFormStore((state) => state.receipt);
  const date = useFormStore((state) => state.date);

  useEffect(() => {
    if (!receipt) {
      navigate({ to: "/po/receipt" })
    }
  }, [receipt]);

  useEffect(() => {
    if (signatureRef.current && signature) {
      signatureRef.current.fromDataURL(signature);
    }
  }, []);

  // Submit mutation using TanStack Query
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) throw new Error("Please upload a receipt before submitting.");

      const { filename } = await uploadBase64Image(receipt, "receipt.jpg");

      const authHeaders = {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        "X-Required-Permission": "po"
      };

      const authAxios = async (fn: () => Promise<any>) => {
        try {
          return await fn();
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            navigate({ to: "/no-access" });
          }
          throw err;
        }
      };

      if(fleetCardNumber){
        let fleetData = null;
        try {
          const fleetResponse = await authAxios(() =>
            axios.get(`${domain}/api/fleet/getByCardNumber/${fleetCardNumber}`, { headers: authHeaders })
          );
          fleetData = fleetResponse.data;
        } catch (err: any) {
          if (axios.isAxiosError(err) && err.response?.status !== 404) throw err;
        }

        if (fleetData && !fleetData.message) {
          await authAxios(() =>
            axios.put(`${domain}/api/fleet/updateByCardNumber/${fleetCardNumber}`, {
              customerName,
              driverName,
              vehicleMakeModel: vehicleInfo,
            }, { headers: authHeaders })
          );
        } else {
          await authAxios(() =>
            axios.post(`${domain}/api/fleet/create`, {
              fleetCardNumber,
              customerName,
              driverName,
              vehicleMakeModel: vehicleInfo,
            }, { headers: authHeaders })
          );
        }
      }

      const stationName = user?.location || 'Rankin';

      const poResponse = await authAxios(() =>
        axios.post(`${domain}/api/purchase-orders`, {
          source: 'PO',
          date,
          stationName,
          fleetCardNumber: fleetCardNumber || '', 
          poNumber: poNumber || '',
          quantity,
          amount,
          productCode: fuelType,
          trx: '',
          signature,
          receipt: filename,
          customerName,
          driverName,
          vehicleInfo,
        }, { headers: authHeaders })
      );

      if (poResponse.status !== 200 && poResponse.status !== 201) {
        throw new Error('Failed to create purchase order');
      }

      return poResponse.data;
    },
    onSuccess: () => {
      console.log('Purchase order created successfully');
      navigate({ to: '/po/list' });
    },
    onError: (error) => {
      console.error('Error submitting data:', error);
      alert('Error submitting purchase order. Please try again.');
    },
  });

  const handleEnd = () => {
    if (signatureRef.current) {
      const signatureData = signatureRef.current.toDataURL('image/png');
      setSignature(signatureData);
      console.log('Signature saved:', signatureData);
    }
  };

  const handleClear = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
      setSignature('');
    }
  };

  const handleSubmit = () => {
    if (!signature) {
      alert('Please provide a signature before submitting.');
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="p-4 border border-dashed border-gray-300 rounded-md space-y-6">
      {/* Signature Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-bold">Signature</h2>
        <SignatureCanvas
          ref={signatureRef}
          penColor="black"
          canvasProps={{
            width: 500,
            height: 200,
            className: 'border border-dashed border-gray-300 rounded-md',
          }}
          onEnd={handleEnd}
        />
        <div className="flex justify-between">
          <Button 
            onClick={handleClear} 
            variant="secondary"
            disabled={submitMutation.isPending}
          >
            Reset Signature
          </Button>
        </div>
      </div>

      <hr className="border-t border-dashed border-gray-300" />

      {/* Navigation Section */}
      <div className="flex justify-between">
        <Link to="/po/receipt">
          <Button 
            variant="outline"
            disabled={submitMutation.isPending}
          >
            Back
          </Button>
        </Link>
        <Button 
          onClick={handleSubmit}
          disabled={submitMutation.isPending || !signature}
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit'
          )}
        </Button>
      </div>
    </div>
  ); 
}