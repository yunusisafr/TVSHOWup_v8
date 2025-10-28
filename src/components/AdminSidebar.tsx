import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Film, Users, Settings, FileText, LogOut, Database, PlusCircle } from 'lucide-react';

const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const isSubdomain = window.location.hostname.startsWith('admin.');
  const baseAdminPath = isSubdomain ? '' : '/admin';

  const navItems = [
    { path: `${baseAdminPath}/`, icon: LayoutDashboard, label: 'Dashboard', active: true },
    { path: `${baseAdminPath}/users`, icon: Users, label: 'User Management', active: true },
    { path: `${baseAdminPath}/pages`, icon: FileText, label: 'Static Pages', active: true },
    { path: `${baseAdminPath}/content`, icon: Film, label: 'Content Management', active: false },
    { path: `${baseAdminPath}/providers`, icon: Database, label: 'Provider Monitoring', active: false },
    { path: `${baseAdminPath}/manual-providers`, icon: PlusCircle, label: 'Manual Providers', active: false },
  ];

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col h-full shadow-lg">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold text-primary-400">Admin Panel</h1>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              {item.active ? (
                <Link
                  to={item.path}
                  className={`flex items-center p-3 rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-600 text-white'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  <span>{item.label}</span>
                </Link>
              ) : (
                <div className="flex items-center p-3 rounded-lg text-gray-500 cursor-not-allowed opacity-50">
                  <item.icon className="w-5 h-5 mr-3" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-xs">(Coming Soon)</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <a
          href={isSubdomain ? `${window.location.protocol}//${window.location.hostname.replace('admin.', '')}/en` : '/en'}
          className="flex items-center p-3 rounded-lg transition-colors hover:bg-gray-700 text-gray-300"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span>Return to Site</span>
        </a>
      </div>
    </div>
  );
};

export default AdminSidebar;