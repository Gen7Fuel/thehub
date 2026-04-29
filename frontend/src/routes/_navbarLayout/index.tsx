import React from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from "@/context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  ClipboardCheck, 
  Wallet, 
  Receipt, 
  Calculator, 
  Package, 
  TrendingUp, 
  GraduationCap, 
  Megaphone,
  FileText,
  Truck,
  Tags,
  Droplets,
  MessageSquare,
  Calendar,
  Layers,
  ShieldCheck,
  BarChart3,
  type LucideProps 
} from 'lucide-react'

export const Route = createFileRoute('/_navbarLayout/')({
  component: App,
})

function App() {
  const { user } = useAuth();
  const access = user?.access || {}

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto px-4 pt-5 pb-12">
        {/* Using 'grid' with 'items-start' ensures that short sections 
          don't stretch to match the height of tall ones.
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            
          {/* AUDITS - EMERALD */}
          {access?.stationAudit?.value && (
            <Section 
              title="Audits" 
              accentColor="border-t-emerald-500" 
              icon={<ClipboardCheck className="w-5 h-5 text-emerald-600" />}
            >
              <NavButton to="/audit" label="Station Audits" icon={Layers} theme="emerald" />
            </Section>
          )}

          {/* ACCOUNTS PAYABLE & RECEIVABLE - BLUE */}
          {(access?.po?.value || access?.payables?.value) && (
            <Section 
              title="Accounts Payables & Receivable" 
              accentColor="border-t-blue-500"
              icon={<Wallet className="w-5 h-5 text-blue-600" />}
            >
              {access?.payables?.value && (
                <NavButton to="/payables" label="Payables & Payouts" icon={Receipt} theme="rose" />
              )}
              {access?.po?.value && (
                <NavButton to="/po" label="Purchase Orders" icon={FileText} theme="blue" />
              )}
            </Section>
          )}

          {/* ACCOUNTS PAYABLE - ROSE */}
          {/* {access?.payables?.value && (
            <Section 
              title="Accounts Payable" 
              accentColor="border-t-rose-500"
              icon={<Receipt className="w-5 h-5 text-rose-600" />}
            >
              <NavButton to="/payables" label="Payables & Payouts" icon={Receipt} theme="rose" />
            </Section>
          )} */}

          {/* ACCOUNTING - AMBER */}
          {access?.accounting?.value && (
            <Section 
              title="Accounting" 
              accentColor="border-t-amber-500"
              icon={<Calculator className="w-5 h-5 text-amber-600" />}
            >
              {access?.accounting?.cashSummary?.value && (
                <NavButton to="/cash-summary" label="Cash Summary" icon={Calculator} theme="amber" search={{ site: user?.location }} />
              )}
              {access?.accounting?.safesheet?.value && (
                <NavButton to="/safesheet" label="Safesheet" icon={ShieldCheck} theme="amber" search={{ site: user?.location }} />
              )}
              {access?.accounting?.cashRec && (
                <NavButton to="/cash-rec" label="Cash Rec" icon={Receipt} theme="amber" search={{ site: user?.location }} />
              )}
              {access?.accounting?.fuelRec?.value && (
                <NavButton 
                  to={access?.accounting?.fuelRec?.bol ? `/fuel-rec` : `/fuel-rec/list`} 
                  label="Fuel Rec" 
                  icon={Droplets} 
                  theme="amber" 
                  search={{ site: user?.location }} 
                />
              )}
              {access?.accounting?.infonetReport && (
                <NavButton to="/infonet-report" label="Infonet Tax Report" icon={BarChart3} theme="amber" search={{ site: user?.location }} />
              )}
            </Section>
          )}

          {/* INVENTORY - INDIGO */}
          {(access?.orderRec?.value || access?.cycleCount?.value || access?.vendor || access?.category || access?.writeOff?.value || access?.fuelManagement?.value) && (
            <Section 
              title="Inventory" 
              accentColor="border-t-indigo-500"
              icon={<Package className="w-5 h-5 text-indigo-600" />}
            >
              {access?.orderRec?.value && (
                <NavButton 
                  to={access?.orderRec?.upload ? "/order-rec" : "/order-rec/list"} 
                  label="Order Rec" 
                  icon={Package} 
                  theme="indigo" 
                  search={!access?.orderRec?.upload ? { site: user?.location || '' } : undefined} 
                />
              )}
              {access?.cycleCount?.value && <NavButton to="/cycle-count" label="Cycle Count" icon={Layers} theme="indigo" />}
              {access?.vendor && <NavButton to="/vendor" label="Vendors" icon={Truck} theme="indigo" />}
              {access?.category && <NavButton to="/category" label="Categories" icon={Tags} theme="indigo" />}
              {access?.writeOff?.value && <NavButton to="/write-off" label="Write Offs" icon={FileText} theme="indigo" />}
              {access?.fuelManagement?.value && (
                <NavButton 
                  to="/fuel-management/workspace" 
                  label="Fuel Mgmt" 
                  icon={Droplets} 
                  theme="indigo" 
                  search={{ site: user?.location || '' }} 
                />
              )}
            </Section>
          )}

          {/* SALES - SLATE */}
          {access?.status?.value && (
            <Section 
              title="Sales" 
              accentColor="border-t-slate-500"
              icon={<TrendingUp className="w-5 h-5 text-slate-600" />}
            >
              <NavButton to="/status" label="Status" icon={TrendingUp} theme="slate" />
            </Section>
          )}

          {/* TRAINING - VIOLET */}
          {access?.training?.voiceAgent && (
            <Section 
              title="Training" 
              accentColor="border-t-violet-500"
              icon={<GraduationCap className="w-5 h-5 text-violet-600" />}
            >
              <NavButton to="/ai-customer" label="AI Customer Chat" icon={MessageSquare} theme="violet" />
              <NavButton to="/ai-customer/mcq" label="MCQ" icon={FileText} theme="violet" />
            </Section>
          )}

          {/* COMMUNICATION - CYAN */}
          {(access?.bulletin || access?.events) && (
            <Section 
              title="Communication" 
              accentColor="border-t-cyan-500"
              icon={<Megaphone className="w-5 h-5 text-cyan-600" />}
            >
              {access?.bulletin && <NavButton to="/bulletin" label="Bulletin Board" icon={Megaphone} theme="slate" />}
              {access?.events && <NavButton to="/events" label="Events" icon={Calendar} theme="slate" />}
            </Section>
          )}

        </div>
      </div>
    </div>
  )
}

interface NavButtonProps {
  to: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
  search?: Record<string, any>;
  theme: 'emerald' | 'blue' | 'amber' | 'indigo' | 'violet' | 'rose' | 'slate';
}

function NavButton({ to, label, icon: Icon, search, theme }: NavButtonProps) {
  // Map themes to specific Tailwind classes for light tint and bold hover
  const themeClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-500 hover:bg-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-500 hover:bg-amber-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100 hover:border-violet-500 hover:bg-violet-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-500 hover:bg-rose-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-500 hover:bg-slate-100",
  };

  return (
    <Link to={to} search={search} className="group">
      <Button 
        variant="outline" 
        className={`
          w-full h-28 flex flex-col items-center justify-center gap-3 
          text-xs transition-all duration-200 shadow-sm
          border-2 font-medium
          group-hover:font-bold group-hover:scale-[1.02]
          active:scale-95
          ${themeClasses[theme]}
        `}
      >
        <div className="p-2 rounded-xl bg-white/80 shadow-sm group-hover:shadow-md transition-all">
          <Icon size={24} className="stroke-[2.5px]" />
        </div>
        <span className="text-center px-1 leading-tight tracking-wide uppercase text-[10px]">
          {label}
        </span>
      </Button>
    </Link>
  )
}

// --- UPDATED SECTION ---
function Section({ title, icon, children, accentColor }: { title: string; icon: React.ReactNode; children: React.ReactNode; accentColor: string }) {
  return (
    <Card className={`overflow-hidden border-t-4 ${accentColor} shadow-md h-full`}>      
      <CardHeader className="pb-3 bg-slate-50/80">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700 uppercase tracking-widest">
          <span className="p-1.5 rounded-lg bg-white shadow-sm">{icon}</span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 px-4 pb-4">
        <div className="grid grid-cols-2 gap-3"> {/* Inner grid for buttons */}
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

// import { createFileRoute, Link } from '@tanstack/react-router'
// import { Button } from '@/components/ui/button'
// import { useAuth } from "@/context/AuthContext";

// export const Route = createFileRoute('/_navbarLayout/')({
//   component: App,
// })

// /**
//  * Main landing page for the navbar layout.
//  * Renders sections and navigation buttons based on user access permissions.
//  */
// function App() {
//   const { user } = useAuth();

//   const access = user?.access || {}

//   return (
//     <div className="flex items-center justify-center min-h-screen bg-gray-50">
//       <div className="flex flex-col gap-8 w-full max-w-3xl px-4 pt-5 pb-8">
//         {/* Audits Section */}
//         {access?.stationAudit?.value && (
//           <Section title="Audits">
//             <div className="flex flex-wrap gap-4">
//               {/* {access.module_station_audit && ( //markpoint */}
//               {access?.stationAudit?.value && (
//                 <Link to="/audit">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Station Audits
//                   </Button>
//                 </Link>
//               )}
//             </div>
//           </Section>
//         )}

//         {/* Accounts Receivable Section */}
//         {/* {(access.module_fleet_card_assignment || access.module_po || access.module_kardpoll) && ( //markpoint */}
//         {(access?.fleetCardAssignment || access?.po?.value || access?.kardpoll) && (
//           <Section title="Accounts Receivable">
//             <div className="flex flex-wrap gap-4">
//               {/* Fleet Card Assignment button */}
//               {/* {access.module_fleet_card_assignment && ( //markpoint */}
//               {access?.fleetCardAssignment && (
//                 <Link to="/fleet">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Fleet Card Assignment
//                   </Button>
//                 </Link>
//               )}
//               {/* Purchase Orders button */}
//               {/* {access.module_po && ( //markpoint */}
//               {access?.po?.value && (
//                 <Link to="/po">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Purchase Orders
//                   </Button>
//                 </Link>
//               )}
//               {/* Kardpoll button */}
//               {/* {access.module_kardpoll && ( //markpoint */}
//               {/* {access?.kardpoll && (
//                 <Link to="/kardpoll">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Kardpoll
//                   </Button>
//                 </Link>
//               )} */}
//             </div>
//           </Section>
//         )}

//         {/* Accounts Payable Section */}
//         {/* {access.module_payables && ( //markpoint */}
//         {access?.payables?.value && (
//           <Section title="Accounts Payable">
//             <div className="flex flex-wrap gap-4">
//               <Link to="/payables">
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   Payables & Payouts
//                 </Button>
//               </Link>
//             </div>
//           </Section>
//         )}

//         {access?.accounting?.value && (
//           <Section title="Accounting">
//             <div className="flex flex-wrap gap-4">
//               {access?.accounting?.cashSummary.value && (
//                 <Link to="/cash-summary" search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Cash Summary
//                   </Button>
//                 </Link>
//               )}
//               {access?.accounting?.safesheet?.value && (
//                 <Link to="/safesheet" search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Safesheet
//                   </Button>
//                 </Link>
//               )}
//               {access?.accounting?.cashRec && (
//                 <Link to="/cash-rec" search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Cash Rec
//                   </Button>
//                 </Link>
//               )}
//               {access?.accounting?.fuelRec.value && (
//                 <Link to={access?.accounting?.fuelRec?.bol ? `/fuel-rec` : `/fuel-rec/list`} search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Fuel Rec
//                   </Button>
//                 </Link>
//               )}
//               {access?.accounting?.infonetReport && (
//                 <Link to="/infonet-report" search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Infonet Tax Report
//                   </Button>
//                 </Link>
//               )}
//               {/* {access?.accounting.sftp && (
//                 <Link to="/sftp" search={{ site: user?.location }}>
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     SFTP
//                   </Button>
//                 </Link>s
//               )} */}
//               {/* {access?.accounting.fuelRec && (
//                 <Link to="/fuel-rec" search={{ site: user?.location }}>
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   Fuel Rec
//                 </Button>
//               </Link>
//               )} */}
//             </div>
//           </Section>
//         )}
//         {/* {access?.safesheet && (
//           <Section title="Safesheet">
//             <div className="flex flex-wrap gap-4">
//               <Link to="/safesheet" search={{ site: user?.location }}>
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   Safesheet
//                 </Button>
//               </Link>
//             </div>
//           </Section>
//         )} */}

//         {/* Support Section */}
//         {/* {access.module_support && ( //markpoint */}
//         {/* {access?.support && (
//           <Section title="Support">
//             <div className="flex flex-wrap gap-4">
//               <Link to="/support">
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   Support
//                 </Button>
//               </Link>
//             </div>
//           </Section>
//         )} */}


//         {/* Inventory Section */}
//         {/* {(access.module_order_rec || access.module_cycle_count) && ( //markpoint */}
//         {(access?.orderRec?.value || access?.cycleCount?.value || access?.vendor || access?.category || access?.writeOff?.value || access?.fuelManagement?.value) && (
//           <Section title="Inventory">
//             <div className="flex flex-wrap gap-4">
//               {/* Order Rec button: goes to upload or list based on access */}
//               {/* {access.module_order_rec && ( //markpoint
//                 access.component_order_rec_upload ? ( */}
//               {access?.orderRec?.value && (
//                 access?.orderRec?.upload ? (
//                   <Link to="/order-rec">
//                     <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                       Order Rec
//                     </Button>
//                   </Link>
//                 ) : (
//                   <Link to="/order-rec/list" search={{ site: user?.location || '' }}>
//                     <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                       Order Rec
//                     </Button>
//                   </Link>
//                 )
//               )}
//               {/* Cycle Count button */}
//               {/* {access.module_cycle_count && ( //markpoint */}
//               {access?.cycleCount?.value && (
//                 <Link to="/cycle-count">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Cycle Count
//                   </Button>
//                 </Link>
//               )}
//               {/* Vendor Management button */}
//               {/* {access.module_vendor && ( //markpoint */}
//               {access?.vendor && (
//                 <Link to="/vendor">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Vendor Management
//                   </Button>
//                 </Link>
//               )}
//               {access?.category && (
//                 <Link to="/category">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Category Management
//                   </Button>
//                 </Link>
//               )}
//               {access?.writeOff?.value && (
//                 <Link to="/write-off">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Write Offs & Markdowns
//                   </Button>
//                 </Link>
//               )}
//               {access?.fuelManagement?.value && (
//                 <Link to="/fuel-management/workspace"
//                   activeOptions={{ exact: true }}
//                   search={{ site: user?.location || ''}}
//                 >
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Fuel Management
//                   </Button>
//                 </Link>
//               )}
//             </div>
//           </Section>
//         )}



//         {/* Reports Section */}
//         {/* {(access.module_daily_reports || access.module_reports) && ( //markpoint */}
//         {/* {(access?.dailyReports || access?.reports) && (
//           <Section title="Reports">
//             <div className="flex flex-wrap gap-4">
//               {access?.dailyReports && (
//                 <Link to="/daily-reports">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Daily Reports
//                   </Button>
//                 </Link>
//               )} 
//               {access?.reports && (
//                 <Link to="/reports">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Reports
//                   </Button>
//                 </Link>
//               )}
//             </div>
//           </Section>
//         )}  */}

//         {/* Sales Section */}
//         {/* {access.module_status && ( //markpoint */}
//         {access?.status?.value && (
//           <Section title="Sales">
//             <div className="flex flex-wrap gap-4">
//               <Link to="/status">
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   Status
//                 </Button>
//               </Link>
//             </div>
//           </Section>
//         )}

//         {access?.training?.voiceAgent && (
//           <Section title="Training">
//             <div className="flex flex-wrap gap-4">
//               <Link to="/ai-customer">
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   AI Customer Chat
//                 </Button>
//               </Link>
//               <Link to="/ai-customer/mcq">
//                 <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                   MCQ
//                 </Button>
//               </Link>
//             </div>
//           </Section>
          
//         )}

//         {(access?.bulletin || access?.events) && (
//           <Section title="Communication">
//             <div className="flex flex-wrap gap-4">
//               {access?.bulletin && (
//                 <Link to="/bulletin">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Bulletin Board
//                   </Button>
//                 </Link>
//               )}
//               {access?.events && (
//                 <Link to="/events">
//                   <Button className="w-32 h-32 flex items-center justify-center break-words whitespace-normal text-center">
//                     Events
//                   </Button>
//                 </Link>
//               )}
//             </div>
//           </Section>
//         )}
//       </div>
//     </div>
//   )
// }

// /**
//  * Section
//  * Helper component for rendering section headings and content with spacing.
//  */
// function Section({ title, children }: { title: string; children: React.ReactNode }) {
//   return (
//     <section>
//       <h2 className="text-lg font-bold mb-2 text-gray-700">{title}</h2>
//       {children}
//     </section>
//   )
// }