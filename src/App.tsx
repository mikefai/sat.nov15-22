import React, { useState } from 'react';
import courseDataJson from './generated/courseData.json';
import type { CourseData } from './types/course';
import { CourseProvider, useCourseStore } from './state/useCourseStore';
import { SidebarRail } from './components/SidebarRail';
import { TopContextHeader } from './components/TopContextHeader';
import { OverviewView } from './views/OverviewView';
import { MasterPlanView } from './views/MasterPlanView';
import { DayStepView } from './views/DayStepView';
import { VocabStudioView } from './views/VocabStudioView';
import { ErrorLogView } from './views/ErrorLogView';

const course = courseDataJson as unknown as CourseData;

const CourseShell: React.FC = () => {
  const { route } = useCourseStore();
  const [focusMode, setFocusMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderMainView = () => {
    switch (route.kind) {
      case 'overview':
        return <OverviewView course={course} />;
      case 'master-plan':
        return <MasterPlanView course={course} activeChapter={route.chapter} />;
      case 'day': {
        const dayObj =
          course.days.find((d) => d.day === route.day) || course.days[0];
        return <DayStepView course={course} dayData={dayObj} step={route.step} />;
      }
      case 'vocab':
        return (
          <VocabStudioView
            course={course}
            initialTab={route.tab}
            initialDayFilter={route.dayFilter}
          />
        );
      case 'error-log':
        return <ErrorLogView course={course} initialTab={route.tab} />;
    }
  };

  return (
    <div className={`course-app-layout ${focusMode ? 'is-focus-mode' : ''}`}>
      <SidebarRail
        course={course}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="course-main-column">
        <TopContextHeader
          course={course}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((v) => !v)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />
        <main className="course-main-canvas">{renderMainView()}</main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <CourseProvider>
      <CourseShell />
    </CourseProvider>
  );
};

export default App;
