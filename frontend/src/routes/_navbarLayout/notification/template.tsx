import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { LayoutList, List, ArrowLeft } from 'lucide-react'; // Added ArrowLeft

export const Route = createFileRoute('/_navbarLayout/notification/template')({
  component: TemplateLayout,
});

function TemplateLayout() {
  const { pathname } = useLocation();

  const isCreateActive = pathname === '/notification/template';
  const isListActive = pathname === '/notification/template/list';

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-gray-50/30 relative">
      {/* Navigation/Back Header Area */}
      <div className="absolute top-6 left-6 z-10">
        <Link to="/notification">
          <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-black hover:bg-white/50 shadow-sm border border-transparent hover:border-gray-200 transition-all">
            <ArrowLeft className="h-4 w-4" />
            Back to Notifications
          </Button>
        </Link>
      </div>

      <div className="pt-6 flex flex-col items-center">
        {/* Navigation Tabs */}
        <div className="flex mb-6 bg-white p-1 rounded-lg border shadow-sm">
          <Link to="/notification/template">
            <Button
              variant={isCreateActive ? 'default' : 'ghost'}
              className={`rounded-md gap-2 ${isCreateActive ? 'bg-black hover:bg-black/80' : ''}`}
              size="sm"
            >
              <LayoutList className="h-4 w-4" /> Create Builder
            </Button>
          </Link>

          <Link to="/notification/template/list">
            <Button
              variant={isListActive ? 'default' : 'ghost'}
              className={`rounded-md gap-2 ${isListActive ? 'bg-black hover:bg-black/80' : ''}`}
              size="sm"
            >
              <List className="h-4 w-4" /> Template List
            </Button>
          </Link>
        </div>

        {/* Form/List Area */}
        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}