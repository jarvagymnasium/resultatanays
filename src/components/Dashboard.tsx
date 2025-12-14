'use client';

import { useAppStore } from '@/lib/store';
import Header from './Header';
import WarningsTab from './tabs/WarningsTab';
import ProgressTab from './tabs/ProgressTab';
import ClassesTab from './tabs/ClassesTab';
import CoursesTab from './tabs/CoursesTab';
import StudentsTab from './tabs/StudentsTab';
import GradesTab from './tabs/GradesTab';
import QuartersTab from './tabs/QuartersTab';
import ArchiveTab from './tabs/ArchiveTab';
import CompareTab from './tabs/CompareTab';
import SnapshotsTab from './tabs/SnapshotsTab';

export default function Dashboard() {
  const { activeTab, isLoading } = useAppStore();

  const renderTab = () => {
    switch (activeTab) {
      case 'warnings':
        return <WarningsTab />;
      case 'progress':
        return <ProgressTab />;
      case 'classes':
        return <ClassesTab />;
      case 'courses':
        return <CoursesTab />;
      case 'students':
        return <StudentsTab />;
      case 'grades':
        return <GradesTab />;
      case 'quarters':
        return <QuartersTab />;
      case 'archive':
        return <ArchiveTab />;
      case 'compare':
        return <CompareTab />;
      case 'snapshots':
        return <SnapshotsTab />;
      default:
        return <WarningsTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)]">
      <Header />
      
      <main className="content-wrap">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="spinner w-12 h-12 mx-auto mb-4"></div>
                <p className="text-gray-500">Laddar data...</p>
              </div>
            </div>
          ) : (
            <div className="fade-in">
              {renderTab()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

