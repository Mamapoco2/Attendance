<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\FaceController;

Route::post('/register-face', [FaceController::class, 'register']);
Route::post('/recognize-face', [FaceController::class, 'recognize']);
Route::post('/attendance', [FaceController::class, 'attendance']);
Route::get('/attendance-records', [FaceController::class, 'attendanceRecords']);
Route::get('/employee-dtr', [FaceController::class, 'employeeDtr']);
Route::get('/employee-dtr-cutoff', [FaceController::class, 'employeeDtrCutoff']);