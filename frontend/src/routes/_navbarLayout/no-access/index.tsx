import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_navbarLayout/no-access/')({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(7);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(prev => prev - 1);
    }, 1000); // 1 second interval

    // Navigate to home when countdown reaches 0
    if (secondsLeft === 0) {
      navigate({ to: '/' });
    }

    return () => clearInterval(interval); // cleanup on unmount
  }, [secondsLeft, navigate]);

  return (
    <div className="flex justify-center items-center min-h-screen flex-col">
      <div className="text-red-600 text-center text-lg font-semibold">
        Access Denied. Contact Admin.
      </div>
      <div className="mt-2 text-center text-gray-700">
        This page will redirect to home in {secondsLeft} second{secondsLeft !== 1 ? 's' : ''}.
      </div>
    </div>
  );
}