import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, CheckCircle2, Clock, TrendingUp,
  Calendar, Users, ListChecks, Zap
} from 'lucide-react';
import API from '../services/api';
import './Analytics.css';

// Interface defining properties of a Meeting document
interface Meeting {
  _id: string;
  title: string;
  status: 'scheduled' | 'ongoing' | 'completed';
  startTime: string;
  participants?: string[];
}

// Interface defining properties of a Task document
interface Task {
  _id: string;
  status: 'todo' | 'in-progress' | 'done';
  createdAt: string;
}

// Query fetch helper: retrieves meetings list from endpoint
const fetchMeetings = async (): Promise<Meeting[]> => {
  const response = await API.get('/meetings');
  const meetingsList = response.data;
  return meetingsList;
};

// Query fetch helper: retrieves tasks list from endpoint
const fetchTasks = async (): Promise<Task[]> => {
  const response = await API.get('/tasks');
  const tasksList = response.data;
  return tasksList;
};

// Array of day labels for the weekly distribution chart
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to count meetings scheduled on each day of the week
const groupByDayOfWeek = (meetings: Meeting[]) => {
  // Initialize counter array with 7 elements (one for each day)
  const counts = [0, 0, 0, 0, 0, 0, 0];
  
  // Loop through meetings explicitly
  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    // Parse meeting time into local Date object
    const date = new Date(meeting.startTime);
    // getDay() returns 0 for Sun, 1 for Mon, etc.
    const dayIndex = date.getDay();
    // Increment the count for that day
    counts[dayIndex] = counts[dayIndex] + 1;
  }
  
  // Format counts into label-value objects
  const chartData = [];
  for (let i = 0; i < DAYS.length; i++) {
    chartData.push({
      label: DAYS[i],
      count: counts[i]
    });
  }
  return chartData;
};

// Props interface for the Bar Chart component
interface BarChartProps {
  data: { label: string; count: number }[];
}

// SVG-based Bar Chart Component for weekly distribution
const BarChartSVG: React.FC<BarChartProps> = (props) => {
  const data = props.data;
  
  // Find the maximum meeting count to scale chart bars appropriately
  let maxVal = 1;
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (item.count > maxVal) {
      maxVal = item.count;
    }
  }

  // Define canvas sizing parameters
  const canvasWidth = 340;
  const canvasHeight = 120;
  const barWidth = 30;
  const spacingGap = 10;

  return (
    <svg viewBox={'0 0 ' + canvasWidth + ' ' + (canvasHeight + 28)} className="bar-svg" aria-label="Meetings per day of week chart">
      {data.map((item, index) => {
        // Calculate dynamic height of bar
        const barHeight = (item.count / maxVal) * canvasHeight;
        
        // Calculate X coordinate offset for the bar column
        const xOffset = index * (barWidth + spacingGap) + 10;
        
        // Calculate Y coordinate (SVG origin starts at top-left)
        const yOffset = canvasHeight - barHeight;

        return (
          <g key={item.label}>
            {/* Render bar shape with subtle rounding */}
            <rect 
              x={xOffset} 
              y={yOffset} 
              width={barWidth} 
              height={barHeight || 2}
              rx="6" 
              className={'bar-rect ' + (item.count > 0 ? 'bar-active' : 'bar-empty')} 
            />
            {/* Render numerical count above bar (only if greater than 0) */}
            {item.count > 0 ? (
              <text 
                x={xOffset + barWidth / 2} 
                y={yOffset - 4} 
                textAnchor="middle" 
                className="bar-label-top"
              >
                {item.count}
              </text>
            ) : null}
            {/* Render day name label below bar column */}
            <text 
              x={xOffset + barWidth / 2} 
              y={canvasHeight + 20} 
              textAnchor="middle" 
              className="bar-label-day"
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Props interface for the Donut Chart component
interface DonutChartProps {
  scheduled: number;
  ongoing: number;
  completed: number;
  total: number;
}

// SVG Donut Chart representing breakdown status metrics
const DonutChart: React.FC<DonutChartProps> = (props) => {
  const scheduled = props.scheduled;
  const ongoing = props.ongoing;
  const completed = props.completed;
  const total = props.total;

  // Circle geometric dimensions
  const radius = 52;
  const centerX = 70;
  const centerY = 70;
  const strokeWidth = 16;
  
  // Calculate total circle boundary path perimeter length
  const circumference = 2 * Math.PI * radius;

  // Segment values list configuration
  const segments = [
    { value: completed, color: '#10B981', label: 'Completed' },
    { value: ongoing,   color: '#F59E0B', label: 'Ongoing'   },
    { value: scheduled, color: '#60A5FA', label: 'Scheduled' },
  ];

  // Calculate segment arcs explicitly using a simple loop
  const arcs = [];
  let runningOffset = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // Calculate percentage value
    let ratio = 0;
    if (total > 0) {
      ratio = segment.value / total;
    }
    
    // Width of colored outline
    const dashLength = ratio * circumference;
    // Gap size to complete loop
    const gapLength = circumference - dashLength;

    arcs.push({
      color: segment.color,
      label: segment.label,
      value: segment.value,
      dash: dashLength,
      gap: gapLength,
      offset: runningOffset
    });

    // Accumulate total offset positions
    runningOffset = runningOffset + dashLength;
  }

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut-svg" aria-label="Meeting status breakdown">
        {/* Render base background gray circle ring */}
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={radius} 
          fill="none" 
          stroke="rgba(15,23,42,0.06)" 
          strokeWidth={strokeWidth} 
        />
        {/* Render segment colored overlays */}
        {arcs.map((arc, index) => (
          <circle 
            key={index} 
            cx={centerX} 
            cy={centerY} 
            r={radius} 
            fill="none"
            stroke={arc.color} 
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dash + ' ' + arc.gap}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
            style={{ 
              transform: 'rotate(-90deg)', 
              transformOrigin: centerX + 'px ' + centerY + 'px' 
            }}
          />
        ))}
        {/* Center label displaying sum value */}
        <text x={centerX} y={centerY - 6} textAnchor="middle" className="donut-total">{total}</text>
        <text x={centerX} y={centerY + 12} textAnchor="middle" className="donut-label">Total</text>
      </svg>

      {/* Legend list indicators */}
      <div className="donut-legend">
        {segments.map((item) => (
          <div key={item.label} className="legend-item">
            <span className="legend-dot" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
            <span className="legend-count">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Central Analytics component page layout
const Analytics: React.FC = () => {
  // Query meetings list using TanStack query hook
  const meetingsQuery = useQuery({
    queryKey: ['meetings'],
    queryFn: fetchMeetings,
  });
  
  // Extract query result details
  const meetings = meetingsQuery.data || [];
  const loadingM = meetingsQuery.isLoading;

  // Query tasks list using TanStack query hook
  const tasksQuery = useQuery({
    queryKey: ['tasks'],
    queryFn: fetchTasks,
  });

  // Extract query result details
  const tasks = tasksQuery.data || [];
  const loadingT = tasksQuery.isLoading;

  // Process data lists to extract summaries with explicit loops
  const stats = useMemo(() => {
    // Total meetings
    const totalMeetingsCount = meetings.length;
    
    // Count status matches explicitly
    let completedMeetings = 0;
    let ongoingMeetings = 0;
    let scheduledMeetings = 0;

    for (let i = 0; i < meetings.length; i++) {
      const status = meetings[i].status;
      if (status === 'completed') {
        completedMeetings = completedMeetings + 1;
      } else if (status === 'ongoing') {
        ongoingMeetings = ongoingMeetings + 1;
      } else if (status === 'scheduled') {
        scheduledMeetings = scheduledMeetings + 1;
      }
    }

    // Calculate ratio percentage safely
    let completionRatePercentage = 0;
    if (totalMeetingsCount > 0) {
      completionRatePercentage = Math.round((completedMeetings / totalMeetingsCount) * 100);
    }

    // Process tasks lists status counters
    const totalTasksCount = tasks.length;
    let completedTasks = 0;
    let activeTasks = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.status === 'done') {
        completedTasks = completedTasks + 1;
      } else if (task.status === 'in-progress') {
        activeTasks = activeTasks + 1;
      }
    }

    // Calculate ratio percentage safely
    let taskCompletionRatePercentage = 0;
    if (totalTasksCount > 0) {
      taskCompletionRatePercentage = Math.round((completedTasks / totalTasksCount) * 100);
    }

    // Parse meetings count grouped by day of week
    const weekdayDistribution = groupByDayOfWeek(meetings);

    return { 
      total: totalMeetingsCount, 
      completed: completedMeetings, 
      ongoing: ongoingMeetings, 
      scheduled: scheduledMeetings, 
      completionRate: completionRatePercentage, 
      taskTotal: totalTasksCount, 
      taskDone: completedTasks, 
      taskProgress: activeTasks, 
      taskRate: taskCompletionRatePercentage, 
      byDay: weekdayDistribution 
    };
  }, [meetings, tasks]);

  // Loading spinner layout
  if (loadingM || loadingT) {
    return (
      <div className="analytics-loading">
        <div className="analytics-spinner" />
        <p>Loading analytics…</p>
      </div>
    );
  }

  return (
    <div className="analytics-root">

      {/* Grid of basic analytics count widgets */}
      <div className="analytics-stat-grid">

        {/* 1. Total meetings card */}
        <div className="analytics-stat-card">
          <div className="stat-icon-wrap blue"><Calendar size={18} /></div>
          <div>
            <p className="stat-card-value">{stats.total}</p>
            <p className="stat-card-label">Total Meetings</p>
          </div>
        </div>

        {/* 2. Completion rate card */}
        <div className="analytics-stat-card">
          <div className="stat-icon-wrap green"><CheckCircle2 size={18} /></div>
          <div>
            <p className="stat-card-value">{stats.completionRate}%</p>
            <p className="stat-card-label">Completion Rate</p>
          </div>
        </div>

        {/* 3. Upcoming meetings card */}
        <div className="analytics-stat-card">
          <div className="stat-icon-wrap amber"><Clock size={18} /></div>
          <div>
            <p className="stat-card-value">{stats.scheduled}</p>
            <p className="stat-card-label">Upcoming</p>
          </div>
        </div>

        {/* 4. Kanban task progress card */}
        <div className="analytics-stat-card">
          <div className="stat-icon-wrap purple"><ListChecks size={18} /></div>
          <div>
            <p className="stat-card-value">{stats.taskDone}/{stats.taskTotal}</p>
            <p className="stat-card-label">Tasks Done</p>
          </div>
        </div>

      </div>

      {/* Visual Chart grids */}
      <div className="analytics-charts-row">

        {/* Bar Chart Container */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <BarChart2 size={16} className="card-header-icon" />
            <h3>Meetings by Day of Week</h3>
          </div>
          {stats.total === 0 ? (
            <p className="analytics-empty">No meeting data yet.</p>
          ) : (
            <BarChartSVG data={stats.byDay} />
          )}
        </div>

        {/* Donut Chart breakdown container */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <TrendingUp size={16} className="card-header-icon" />
            <h3>Meeting Status Breakdown</h3>
          </div>
          {stats.total === 0 ? (
            <p className="analytics-empty">No meeting data yet.</p>
          ) : (
            <DonutChart
              scheduled={stats.scheduled}
              ongoing={stats.ongoing}
              completed={stats.completed}
              total={stats.total}
            />
          )}
        </div>

      </div>

      {/* Task progress metrics bar card */}
      <div className="analytics-card analytics-task-card">
        <div className="analytics-card-header">
          <Zap size={16} className="card-header-icon" />
          <h3>Task Progress Overview</h3>
        </div>

        {stats.taskTotal === 0 ? (
          <p className="analytics-empty">No tasks created yet.</p>
        ) : (
          <div className="task-progress-body">

            {/* Linear completion progress bar */}
            <div className="task-progress-meta">
              <span>{stats.taskDone} of {stats.taskTotal} tasks completed</span>
              <span className="task-progress-pct">{stats.taskRate}%</span>
            </div>
            <div className="task-progress-bar-track">
              <div className="task-progress-bar-fill" style={{ width: stats.taskRate + '%' }} />
            </div>

            {/* Individual category count badges */}
            <div className="task-chips">
              <div className="task-chip chip-todo">
                <Users size={13} />
                <span>{stats.taskTotal - stats.taskDone - stats.taskProgress} To Do</span>
              </div>
              <div className="task-chip chip-progress">
                <Clock size={13} />
                <span>{stats.taskProgress} In Progress</span>
              </div>
              <div className="task-chip chip-done">
                <CheckCircle2 size={13} />
                <span>{stats.taskDone} Done</span>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default Analytics;

