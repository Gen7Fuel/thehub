import {
  createFileRoute,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/_navbarLayout/upload-invoice")({
  component: RouteComponent,
});

/**
 * RouteComponent
 * Renders the cycle count section with navigation buttons for Input, Count, and Console.
 * Buttons are conditionally styled and rendered based on user access permissions.
 */
function RouteComponent() {
  // Hook to match the current route for button highlighting
  const matchRoute = useMatchRoute();

  // Determine if each tab is active
  // const isInputActive = matchRoute({ to: '/cycle-count' });
  const isUploadActive = matchRoute({ to: "/upload-invoice" });
  const isListActive = matchRoute({ to: "/upload-invoice/list" });

  const { user } = useAuth();

  // Retrieve access permissions from Auth provider
  // const access = user?.access || "{}" //markpoint
  const access = user?.access || {};

  return (
    <div className="pt-5 flex flex-col items-center">
      {/* Navigation buttons for cycle count sections */}
      <div className="flex mb-4">

        {/* Upload tab button */}
        <Link to="/upload-invoice" activeOptions={{ exact: true }}>
          <Button
            {...(!isUploadActive && ({ variant: "outline" } as object))}
            className={access?.uploadInvoice?.list?.value ? "rounded-r-none" : ""}
          >
            Upload
          </Button>
        </Link>

        {access?.uploadInvoice?.list?.value && (
          <Link to="/upload-invoice/list" activeOptions={{ exact: true }}>
            <Button
              {...(!isListActive && ({ variant: "outline" } as object))}
              className="rounded-l-none"
            >
              List
            </Button>
          </Link>
        )}
      </div>
      {/* Render the nested route content */}
      <Outlet />
    </div>
  );
}
