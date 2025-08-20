import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  loginError = false;
  loginSuccess = false;

  constructor(private router: Router){}

  // Dummy credentials
  private readonly dummyEmail = 'user@example.com';
  private readonly dummyPassword = 'password123';

  onSubmit() {
    if (this.email === this.dummyEmail && this.password === this.dummyPassword) {
      this.loginSuccess = true;
      this.loginError = false;
      this.router.navigateByUrl('student');
    } else {
      this.loginError = true;
      this.loginSuccess = false;
    }
  }
}
