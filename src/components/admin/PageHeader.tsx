import React from 'react';
import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, breadcrumbs, actions }) => {
  return (
    <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-400 mb-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-primary-400 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-gray-300">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4" />}
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">{title}</h1>
        {actions && <div className="flex items-center space-x-3">{actions}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
