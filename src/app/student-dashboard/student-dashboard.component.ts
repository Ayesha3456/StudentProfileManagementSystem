import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

type Att = 'Present' | 'Absent';
type Type = 'School' | 'College';
type Filter = 'All' | 'Present' | 'Absent' | 'School' | 'College';

interface Student {
  id: number;      // internal numeric ID (timestamp)
  uid: string;     // short, human-friendly unique ID
  name: string;
  type: Type;
  attendance: Att;
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-dashboard.component.html',
  styleUrls: ['./student-dashboard.component.scss']
})
export class StudentDashboardComponent implements OnInit, AfterViewInit {
  // Data
  students: Student[] = [];
  filteredStudents: Student[] = [];

  // UI state
  currentFilter: Filter = 'All';

  // Stats (based on filteredStudents)
  totalCount = 0;
  presentCount = 0;
  absentCount = 0;

  // Add form
  addForm = {
    name: '',
    type: 'School' as Type
  };

  // Edit modal
  showEditModal = false;
  modalClosing = false;
  editModel: Student | null = null;

  // Chart anchor
  @ViewChild('attendanceDonut', { static: false }) attendanceEl?: ElementRef<HTMLDivElement>;
  private viewReady = false;

  // ------------- Lifecycle -------------
  ngOnInit(): void {
    this.load();
    this.applyFilter('All'); // compute counts immediately
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderChart();
  }

  // ------------- Local Storage -------------
  private save(): void {
    localStorage.setItem('students', JSON.stringify(this.students));
  }

  private load(): void {
    const raw = localStorage.getItem('students');
    const parsed: any[] = raw ? JSON.parse(raw) : [];
    // migrate older records (add uid if missing)
    this.students = parsed.map((s) => ({
      id: s.id ?? Date.now(),
      uid: s.uid ?? this.makeUID(),
      name: s.name ?? '',
      type: (s.type === 'College' ? 'College' : 'School') as Type,
      attendance: (s.attendance === 'Absent' ? 'Absent' : 'Present') as Att
    }));
    // ensure uniqueness of uid after migration
    const seen = new Set<string>();
    this.students.forEach(s => {
      if (seen.has(s.uid)) s.uid = this.makeUID();
      seen.add(s.uid);
    });
    this.save();
  }

  private makeUID(): string {
    const partA = Date.now().toString(36).toUpperCase().slice(-4);
    const partB = Math.random().toString(36).toUpperCase().slice(2, 6);
    return `STU-${partA}${partB}`;
  }

  // ------------- Filtering & Stats -------------
  applyFilter(f: Filter): void {
    this.currentFilter = f;

    switch (f) {
      case 'Present':
      case 'Absent':
        this.filteredStudents = this.students.filter(s => s.attendance === f);
        break;
      case 'School':
      case 'College':
        this.filteredStudents = this.students.filter(s => s.type === f);
        break;
      default:
        this.filteredStudents = [...this.students];
    }

    this.updateStats();
    this.renderChart();
  }

  clearFilter(): void {
    this.applyFilter('All');
  }

  private updateStats(): void {
    this.totalCount = this.filteredStudents.length;
    this.presentCount = this.filteredStudents.filter(s => s.attendance === 'Present').length;
    this.absentCount = this.filteredStudents.filter(s => s.attendance === 'Absent').length;
  }

  // ------------- CRUD -------------
  addStudent(): void {
    const name = this.addForm.name.trim();
    if (!name) return;

    const newStudent: Student = {
      id: Date.now(),
      uid: this.makeUID(),
      name,
      type: this.addForm.type,
      attendance: 'Present' // default as requested
    };

    this.students.push(newStudent);
    this.save();

    // reset form
    this.addForm = { name: '', type: 'School' };
    this.applyFilter(this.currentFilter);
  }

  deleteStudent(id: number): void {
    if (!confirm('Delete this student?')) return;
    this.students = this.students.filter(s => s.id !== id);
    this.save();
    this.applyFilter(this.currentFilter);
  }

  openEdit(student: Student): void {
    // clone to avoid mutating table until save
    this.editModel = { ...student };
    this.showEditModal = true;
  }

  saveEdit(): void {
    if (!this.editModel) return;
    const idx = this.students.findIndex(s => s.id === this.editModel!.id);
    if (idx > -1) {
      this.students[idx] = { ...this.editModel };
      this.save();
      this.applyFilter(this.currentFilter);
    }
    this.cancelEdit();
  }

  cancelEdit(): void {
    // play exit animation
    this.modalClosing = true;
    setTimeout(() => {
      this.showEditModal = false;
      this.modalClosing = false;
      this.editModel = null;
    }, 250); // match CSS duration
  }

  // ------------- Attendance (inline) -------------
  onAttendanceChange(student: Student, att: Att): void {
    const idx = this.students.findIndex(s => s.id === student.id);
    if (idx > -1) {
      this.students[idx].attendance = att;
      this.save();
      this.applyFilter(this.currentFilter); // refresh stats/chart respecting filter
    }
  }

  // ------------- Chart (D3 donut) -------------
  private renderChart(): void {
    if (!this.viewReady || !this.attendanceEl?.nativeElement) return;

    const container = d3.select(this.attendanceEl.nativeElement);
    container.selectAll('*').remove();

    const total = this.presentCount + this.absentCount;

    // No data state
    if (total === 0) {
      const W = 320, H = 200;
      const svg = container.append('svg').attr('width', W).attr('height', H);
      svg.append('text')
        .attr('x', W / 2)
        .attr('y', H / 2)
        .attr('text-anchor', 'middle')
        .style('font-weight', '600')
        .style('font-size', '14px')
        .text('No Data');
      return;
    }

    // Use only positive slices so we don't render 0 values
    const data = [
      { label: 'Present', value: this.presentCount },
      { label: 'Absent', value: this.absentCount }
    ].filter(d => d.value > 0);

    const W = 320;
    const H = 240;
    const R = Math.min(W, H) / 2 - 10;
    const inner = R * 0.62;

    const svg = container.append('svg').attr('width', W).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);

    const color = d3.scaleOrdinal<string>()
      .domain(data.map(d => d.label))
      .range(['#22c55e', '#ef4444']); // green, red

    const pie = d3.pie<{ label: string; value: number }>()
      .value(d => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>()
      .innerRadius(inner)
      .outerRadius(R);

    const arcs = g.selectAll('path')
      .data(pie(data))
      .enter();

    // slices
    arcs.append('path')
      .attr('d', arc as any)
      .attr('fill', d => color(d.data.label) as string);

    // numbers on slices (only if > 0 which is ensured)
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '13px')
      .style('fill', '#fff')
      .text(d => d.data.value.toString());

    // center label: % Present
    const pct = Math.round((this.presentCount / total) * 100);
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 8)
      .style('font-weight', '600')
      .style('font-size', '14px')
      .text(`${pct}% Present`);
  }

  // ------------- Utils -------------
  trackById = (_: number, s: Student) => s.id;
}
