import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { Button } from "@/components/ui/button";
import { LayoutList, List } from 'lucide-react';

export const Route = createFileRoute('/_navbarLayout/notification/template')({
  component: TemplateLayout,
});

function TemplateLayout() {
  const { pathname } = useLocation();
  
  // Logic to determine active state
  const isCreateActive = pathname === '/notification/template' || pathname === '/notification/template/';
  const isListActive = pathname === '/notification/template/list';

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] bg-gray-50/30">
      <div className="pt-6 flex flex-col items-center">
        {/* Navigation Tabs */}
        <div className="flex mb-6 bg-white p-1 rounded-lg border shadow-sm">
          <Link to="/notification/template">
            <Button
              variant={isCreateActive ? 'default' : 'ghost'}
              className={`rounded-md gap-2 ${isCreateActive ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
              size="sm"
            >
              <LayoutList className="h-4 w-4" /> Create Builder
            </Button>
          </Link>

          <Link to="/notification/template/list">
            <Button
              variant={isListActive ? 'default' : 'ghost'}
              className={`rounded-md gap-2 ${isListActive ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
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