# FindMyFaculty · Premium University Web Prototype

**Find your faculty. Save your time.**

FindMyFaculty is a university faculty tracking and scheduling application designed for **SCSVMV University** (Kanchipuram). It helps students find faculty members in real time, check their current status and room location, view timetables, and know when faculty will be available.

---

## 🚀 Application Architecture & Flow

The application implements a strict **Role-Based Access Control (RBAC)** flow:

```
                          ┌──────────────────────────┐
                          │   PAGE 1: OPENING PAGE   │
                          │      Role Selection      │
                          └─────────────┬────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
│     👨‍🎓 STUDENT       │    │     👨‍🏫 FACULTY       │    │       🛡️ ADMIN        │
│      Login Page       │    │      Login Page       │    │      Login Page       │
└──────────┬────────────┘    └──────────┬────────────┘    └──────────┬────────────┘
           ▼                            ▼                            ▼
┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
│   Student Dashboard   │    │   Faculty Dashboard   │    │    Admin Dashboard    │
│  • Find Faculty       │    │  • Live Status Card   │    │  • 6 Stat Cards       │
│  • Available Now (32) │    │  • Today's Schedule   │    │  • Faculty Management │
│  • Student Timetable  │    │  • Update Status/Loc  │    │  • Student Management │
│  • Faculty Profiles   │    │  • Weekly Timetable   │    │  • Timetable Editor   │
│  • Cabin Directions   │    │  • Profile Management │    │  • Department Mgmt    │
│  • Give Feedback (Q1-6│    │  • Slot Requests      │    │  • Live Status Wall   │
└───────────────────────┘    └───────────────────────┘    │  • Feedback Analytics │
                                                          └───────────────────────┘
```

---

## 🔑 Demo Accounts & Quick Logins

Every role has one-click demo credentials directly on the login screen:

| Role | Username / ID | Password | Display Name | Permissions |
|---|---|---|---|---|
| **Student** | `sandeep` | `sandeep123` | Sandeep Kumar · 21CSE042 | Search faculty, live status, cabin directions, student timetable, give feedback |
| **Faculty** | `dr.ravikumar` | `faculty123` | Dr. Ravi Kumar (Assoc Prof, CSE) | Update live status & room location, view today's timeline, weekly timetable, profile |
| **Faculty (HOD)** | `dr.v.geetha` | `faculty123` | Dr. V. Geetha (Prof & HOD, CSE) | Department status & schedule management |
| **Admin** | `admin` | `admin123` | System Administrator | Manage students, faculty, departments, timetables, live status override wall, feedback analytics |

---

## ✨ Features by Role

### 👨‍🎓 1. Student Portal
- **Dashboard**:
  - Personal greeting (*“Good morning, Sandeep 👋”*)
  - Hero search bar: *“Search faculty by name, department or subject…”*
  - 4 Quick action cards: **Find Faculty**, **Available Now** (count badge), **My Timetable**, **Recent Searches**
  - **Faculty Status** section showing live cards with colored status indicators (🟢 Available, 🔵 Teaching, 🟠 In Meeting, 🟣 On Duty, 🔴 Unavailable).
- **Find Faculty Screen**:
  - Search + 4 live filters: Department (CSE, ECE, EEE, MECH, CIVIL, IT, AI&DS, MBA), Subject, Availability, Year.
  - Faculty cards with current location, activity, next free time, and **View Details** action.
- **Faculty Profile Modal**:
  - Full details for Dr. Ravi Kumar (Associate Professor, CSE)
  - Large status banner (🟢 **AVAILABLE NOW**)
  - Current Location: 📍 **CSE Block — Room 204**
  - Current Activity: **Free / Doubt Clearing**
  - Next Class: **11:00 AM — DBMS**
  - Next Available: **Now**
  - Actions:
    - 🧭 **Get Directions**: Interactive campus map highlighting CSE/ECE/Admin blocks, floor level, and step-by-step cabin walking instructions.
    - 📅 **View Timetable**: Complete weekly timetable schedule for the faculty member.
    - ✉️ **Contact Faculty**: Email, intercom phone, office hours, and quick message form.
    - 📅 **Request a Slot**: 15 / 30 / 45-minute appointment booking.
  - Today's complete timetable schedule timeline below.
- **Student Timetable (My Timetable)**:
  - Section selector (e.g., III Year CSE A) and Day picker with period-by-period class schedule and classrooms.
- **Give Feedback**:
  - Interactive questionnaire with the 6 required questions:
    1. Do you currently face difficulty finding faculty?
    2. How do you currently find faculty?
    3. Which feature is most useful?
    4. How useful is FindMyFaculty? (1–5 ⭐)
    5. Would you use this system in your college?
    6. What would you improve?
  - Instant submission with a success screen.

---

### 👨‍🏫 2. Faculty Portal
- **Dashboard**:
  - Welcome header (*“Welcome, Dr. Ravi Kumar”*)
  - Prominent Live Status Card:
    - 🟢 **AVAILABLE**
    - Location: **CSE Block — Room 204**
    - Activity: **Free**
    - Quick buttons: **Update Status**, **Update Location**, **View Timetable**, **View Profile**
  - **Today's Schedule** (Timeline: 08:00 DBMS Room 201, 10:00 Free, 11:00 DBMS Room 204, 01:00 Lunch, 02:00 Dept Meeting, 04:00 Free)
  - **Quick Actions** grid (Update Availability, Update Location, View Timetable, View Profile).
- **Update Status & Location**:
  - 🟢 Available, 🔵 Teaching, 🟠 In Meeting, 🟣 On Duty, 🔴 Unavailable
  - Inputs for Current Room / Location, Current Activity, and Expected return time.
  - Displays: **Last updated: Just now**.
- **My Timetable**:
  - Full weekly timetable grid (Monday to Friday, periods 1–7) showing Subject, Section, Room.
- **Profile**:
  - Editable designation, cabin room, subjects taught, contact email, phone, and office hours.

---

### 🛡️ 3. Admin Portal
- **Dashboard**:
  - **6 Stat Cards**: Total Students (1,250), Total Faculty (85), Departments (8), Currently Available (32), Currently Teaching (41), Unavailable (12).
- **Faculty Management**:
  - Table: Faculty ID | Name | Department | Status | Location | Actions (View, Edit, Deactivate) + **+ Add Faculty** button.
- **Student Management**:
  - Table: Student ID | Name | Department | Year | Section | Status + **+ Add Student** button.
- **Timetable Management**:
  - Department and Section selector, timetable slot viewer and editor.
- **Department Management**:
  - Manage 8 Departments (CSE, ECE, EEE, MECH, CIVIL, IT, AI&DS, Management Studies) with Add, Edit, Delete.
- **Live Faculty Status (Monitor)**:
  - Real-time Wall showing all faculty with 🟢 Available, 🔵 Teaching, 🟠 Meeting, 🟣 Duty, 🔴 Unavailable, Current Room/Location, and Quick Override buttons (Set Free, Set Meeting, Set Duty, Set Absent).
- **Student Feedback Analytics**:
  - Total responses (58), Average rating (4.8 / 5 ⭐), Most requested feature breakdown, Difficulty breakdown, and student suggestions table.

---

## 🛠️ Technology & Design System

- **Backend**: Python 3 standard library (`http.server` + `sqlite3`), zero external pip dependencies.
- **Frontend**: Clean single-page application (`index.html` + `app.js`), zero build step.
- **Theme**: Light Mode & Dark Mode with silky CSS variables and persistent toggle.
- **Resilience**: Safe storage fallback for sandboxed iframe previews, preflight-safe API requests.

---

## 🧪 Testing

Run the automated test suite:

```bash
# Terminal 1 — Start Server
python3 server.py 8123

# Terminal 2 — Run Prototype E2E Test Suite
node tests/test_e2e_prototype.js
```
