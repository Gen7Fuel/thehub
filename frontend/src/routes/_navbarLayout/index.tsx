import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext";
// Define the root route for the navbar layout using TanStack Router
export const Route = createFileRoute('/_navbarLayout/')({
  component: App,
})

/**
 * App
 * Main landing page for the navbar layout.
 * Renders sections and navigation buttons based on user access permissions.
 */
function App() {
  const { user } = useAuth();
  // Retrieve access permissions from auth provider
  const access = user?.access || '{}'

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col gap-8 w-full max-w-3xl px-4 pt-16 pb-8">
        {/* Support Section */}
        {access.module_support && (
          <Section title="Support">
            <div className="flex flex-wrap gap-4">
              <Link to="/support">
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Support
                </Button>
              </Link>
            </div>
          </Section>
        )}
        {/* Audits Section */}
        {access.module_station_audit && (
          <Section title="Audits">
            <div className="flex flex-wrap gap-4">
              {access.module_station_audit && (
                <Link to="/audit">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Station Audits
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* Inventory Section */}
        {(access.module_order_rec || access.module_cycle_count) && (
          <Section title="Inventory">
            <div className="flex flex-wrap gap-4">
              {/* Order Rec button: goes to upload or list based on access */}
              {access.module_order_rec && (
                access.component_order_rec_upload ? (
                  <Link to="/order-rec">
                    <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                      Order Rec
                    </Button>
                  </Link>
                ) : (
                  <Link to="/order-rec/list" search={{ site: localStorage.getItem('location') || '' }}>
                    <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                      Order Rec
                    </Button>
                  </Link>
                )
              )}
              {/* Cycle Count button */}
              {access.module_cycle_count && (
                <Link to="/cycle-count">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Cycle Count
                  </Button>
                </Link>
              )}
              {/* Vendor Management button */}
              {access.module_vendor && (
                <Link to="/vendor">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Vendor Management
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* Accounts Receivable Section */}
        {(access.module_fleet_card_assignment || access.module_po || access.module_kardpoll) && (
          <Section title="Accounts Receivable">
            <div className="flex flex-wrap gap-4">
              {/* Fleet Card Assignment button */}
              {access.module_fleet_card_assignment && (
                <Link to="/fleet">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Fleet Card Assignment
                  </Button>
                </Link>
              )}
              {/* Purchase Orders button */}
              {access.module_po && (
                <Link to="/po">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Purchase Orders
                  </Button>
                </Link>
              )}
              {/* Kardpoll button */}
              {access.module_kardpoll && (
                <Link to="/kardpoll">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Kardpoll
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* Accounts Payable Section */}
        {access.module_payables && (
          <Section title="Accounts Payable">
            <div className="flex flex-wrap gap-4">
              <Link to="/payables">
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Payables & Payouts
                </Button>
              </Link>
            </div>
          </Section>
        )}

        {/* Reports Section */}
        {(access.module_daily_reports || access.module_reports) && (
          <Section title="Reports">
            <div className="flex flex-wrap gap-4">
              {/* Daily Reports button */}
              {access.module_daily_reports && (
                <Link to="/daily-reports">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Daily Reports
                  </Button>
                </Link>
              )}
              {/* Reports button */}
              {access.module_reports && (
                <Link to="/reports">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Reports
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* Sales Section */}
        {access.module_status && (
          <Section title="Sales">
            <div className="flex flex-wrap gap-4">
              <Link to="/status">
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Status
                </Button>
              </Link>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

/**
 * Section
 * Helper component for rendering section headings and content with spacing.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold mb-2 text-gray-700">{title}</h2>
      {children}
    </section>
  )
}