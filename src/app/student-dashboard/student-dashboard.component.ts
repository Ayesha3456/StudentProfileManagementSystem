import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as d3 from 'd3';

type Att = 'Present' | 'Absent';
type Type = 'School' | 'College';
type Filter = 'All' | 'Present' | 'Absent' | 'School' | 'College';

interface Student {
  id: number;
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
export class StudentDashboardComponent implements OnInit {

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

  private viewReady = false;

  ngOnInit(): void {
    this.load();
    this.applyFilter('All'); // compute counts immediately
    this.viewReady = true;
    this.renderChart();
  }

  // ---------------- Local Storage ----------------
  private save(): void {
    localStorage.setItem('students', JSON.stringify(this.students));
  }

  private load(): void {
    const raw = localStorage.getItem('students');
    this.students = raw ? (JSON.parse(raw) as Student[]) : [];
  }

  // ---------------- Filtering & Stats ----------------
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

  // ---------------- CRUD ----------------
  addStudent(): void {
    const name = this.addForm.name.trim();
    if (!name) return;

    const newStudent: Student = {
      id: Date.now(),
      name,
      type: this.addForm.type,
      attendance: 'Absent' // default
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

  // ---------------- Attendance (inline in table) ----------------
  onAttendanceChange(student: Student, att: Att): void {
    const idx = this.students.findIndex(s => s.id === student.id);
    if (idx > -1) {
      this.students[idx].attendance = att;
      this.save();
      this.applyFilter(this.currentFilter); // refresh stats/chart respecting filter
    }
  }

  // ---------------- Chart (D3 donut) ----------------
  private renderChart(): void {
    if (!this.viewReady) return;

    const containerEl = document.getElementById('attendanceDonut');
    if (!containerEl) return;

    const container = d3.select('#attendanceDonut');
    container.selectAll('*').remove();

    const data = [
      { label: 'Present', value: this.presentCount },
      { label: 'Absent', value: this.absentCount }
    ];

    const W = 300;
    const H = 220;
    const R = Math.min(W, H) / 2 - 10;
    const inner = R * 0.6;

    const svg = container
      .append('svg')
      .attr('width', W)
      .attr('height', H);

    const g = svg.append('g')
      .attr('transform', `translate(${W / 2},${H / 2})`);

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

    // values inside slices
    arcs.append('text')
      .attr('transform', d => `translate(${arc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '13px')
      .style('fill', '#fff')
      .text(d => d.data.value.toString());

    // center label (percentage present if any students)
    const total = this.presentCount + this.absentCount;
    const pct = total ? Math.round((this.presentCount / total) * 100) : 0;

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 8)
      .style('font-weight', '600')
      .style('font-size', '14px')
      .text(total ? `${pct}% Present` : 'No Data');
  }
}
