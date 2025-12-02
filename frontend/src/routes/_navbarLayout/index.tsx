import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute('/_navbarLayout/')({
  component: App,
})

/**
 * Main landing page for the navbar layout.
 * Renders sections and navigation buttons based on user access permissions.
 */
function App() {
  const { user  } = useAuth();

  const access = user?.access || {}

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col gap-8 w-full max-w-3xl px-4 pt-16 pb-8">
        {/* Audits Section */}
        {access?.stationAudit?.value && (
          <Section title="Audits">
            <div className="flex flex-wrap gap-4">
              {/* {access.module_station_audit && ( //markpoint */}
              {access?.stationAudit?.value && (
                <Link to="/audit">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Station Audits
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        {/* Accounts Receivable Section */}
        {/* {(access.module_fleet_card_assignment || access.module_po || access.module_kardpoll) && ( //markpoint */}
        {(access?.fleetCardAssignment || access?.po?.value || access?.kardpoll) && (
          <Section title="Accounts Receivable">
            <div className="flex flex-wrap gap-4">
              {/* Fleet Card Assignment button */}
              {/* {access.module_fleet_card_assignment && ( //markpoint */}
              {access?.fleetCardAssignment && (
                <Link to="/fleet">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Fleet Card Assignment
                  </Button>
                </Link>
              )}
              {/* Purchase Orders button */}
              {/* {access.module_po && ( //markpoint */}
              {access?.po?.value && (
                <Link to="/po">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Purchase Orders
                  </Button>
                </Link>
              )}
              {/* Kardpoll button */}
              {/* {access.module_kardpoll && ( //markpoint */}
              {/* {access?.kardpoll && (
                <Link to="/kardpoll">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Kardpoll
                  </Button>
                </Link>
              )} */}
            </div>
          </Section>
        )}

        {/* Accounts Payable Section */}
        {/* {access.module_payables && ( //markpoint */}
        {access?.payables && (
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

        {access?.accounting?.value && (
          <Section title="Accounting">
            <div className="flex flex-wrap gap-4">
              {access?.accounting?.cashSummary && (
                <Link to="/cash-summary" search={{ site: user?.location }}>
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Cash Summary
                  </Button>
                </Link>
              )}
              {access?.accounting?.safesheet && (
                <Link to="/safesheet" search={{ site: user?.location }}>
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Safesheet
                  </Button>
                </Link>
              )}
              {access?.accounting?.cashRec && (
                <Link to="/cash-rec" search={{ site: user?.location }}>
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Cash Rec
                  </Button>
                </Link>
              )}
              {/* {access?.accounting.sftp && (
                <Link to="/sftp" search={{ site: user?.location }}>
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    SFTP
                  </Button>
                </Link>s
              )} */}
              {/* {access?.accounting.fuelRec && (
                <Link to="/fuel-rec" search={{ site: user?.location }}>
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Fuel Rec
                </Button>
              </Link>
              )} */}
            </div>
          </Section>
        )}
        {/* {access?.safesheet && (
          <Section title="Safesheet">
            <div className="flex flex-wrap gap-4">
              <Link to="/safesheet" search={{ site: user?.location }}>
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Safesheet
                </Button>
              </Link>
            </div>
          </Section>
        )} */}

        {/* Support Section */}
        {/* {access.module_support && ( //markpoint */}
        {/* {access?.support && (
          <Section title="Support">
            <div className="flex flex-wrap gap-4">
              <Link to="/support">
                <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                  Support
                </Button>
              </Link>
            </div>
          </Section>
        )} */}
        

        {/* Inventory Section */}
        {/* {(access.module_order_rec || access.module_cycle_count) && ( //markpoint */}
        {(access?.orderRec?.value || access?.cycleCount?.value) && (
          <Section title="Inventory">
            <div className="flex flex-wrap gap-4">
              {/* Order Rec button: goes to upload or list based on access */}
              {/* {access.module_order_rec && ( //markpoint
                access.component_order_rec_upload ? ( */}
              {access?.orderRec?.value && (
                access?.orderRec?.upload ? (
                  <Link to="/order-rec">
                    <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                      Order Rec
                    </Button>
                  </Link>
                ) : (
                  <Link to="/order-rec/list" search={{ site: user?.location || '' }}>
                    <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                      Order Rec
                    </Button>
                  </Link>
                )
              )}
              {/* Cycle Count button */}
              {/* {access.module_cycle_count && ( //markpoint */}
              {access?.cycleCount?.value && (
                <Link to="/cycle-count">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Cycle Count
                  </Button>
                </Link>
              )}
              {/* Vendor Management button */}
              {/* {access.module_vendor && ( //markpoint */}
              {access?.vendor && (
                <Link to="/vendor">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Vendor Management
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}

        

        {/* Reports Section */}
        {/* {(access.module_daily_reports || access.module_reports) && ( //markpoint */}
        {/* {(access?.dailyReports || access?.reports) && (
          <Section title="Reports">
            <div className="flex flex-wrap gap-4">
              {access?.dailyReports && (
                <Link to="/daily-reports">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Daily Reports
                  </Button>
                </Link>
              )} 
              {access?.reports && (
                <Link to="/reports">
                  <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
                    Reports
                  </Button>
                </Link>
              )}
            </div>
          </Section>
        )}  */}

        {/* Sales Section */}
        {/* {access.module_status && ( //markpoint */}
        {access?.status?.value && (
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