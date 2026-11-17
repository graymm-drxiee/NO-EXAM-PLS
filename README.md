<div align="center">
  <h1>CSD Laptop Borrowing System</h1>
  <p><strong>Borrow smart. Code anywhere.</strong><br>
  A simple way for the Computer Studies Department to manage shared laptops, reservations, and returns.</p>
  <p><img src="csd-laptop-borrowing.png" alt="CSD Laptop Borrowing System landing page" width="100%"></p>
  <p>
    <a href="#overview">Overview</a> ·
    <a href="#features">Features</a> ·
    <a href="#api">API</a>
  </p>
  <p>
    <img alt="React" src="https://img.shields.io/badge/React-30212F?style=flat-square&logo=react&logoColor=61DAFB">
    <img alt="Vite" src="https://img.shields.io/badge/Vite-30212F?style=flat-square&logo=vite&logoColor=BB8AFF">
    <img alt="Node.js" src="https://img.shields.io/badge/Node.js-30212F?style=flat-square&logo=nodedotjs&logoColor=83CD29">
    <img alt="Express" src="https://img.shields.io/badge/Express-30212F?style=flat-square&logo=express&logoColor=FFFFFF">
    <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-30212F?style=flat-square&logo=mongodb&logoColor=47A248">
  </p>
</div>

## Overview

The CSD Laptop Borrowing System brings laptop availability, student loan requests, and inventory management into one application. Students can reserve and track equipment, while administrators manage the fleet and loan lifecycle.

## Features

| Students | Administrators |
| --- | --- |
| Browse laptop availability and details | Add, edit, and remove laptop records |
| Register and sign in | Update maintenance status |
| Request or cancel a loan | Review loans and record returns |
| Review personal reservations | Manage student account status |

Authenticated actions use JWTs, with role-based access for administrative workflows.

## Technology

| Frontend | Backend | Data |
| --- | --- | --- |
| React, Vite | Node.js, Express | MongoDB, Mongoose |

## API

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Laptops | `GET /api/laptops`, `GET /api/laptops/:id`; administrator create, update, delete, and maintenance actions |
| Loans | `GET /api/loans`, `POST /api/loans`, `PATCH /api/loans/:id/cancel` |
| Administration | Loan and student management under `/api/admin` |

Protected endpoints require a valid bearer token. Administrative endpoints are restricted to administrator accounts.
