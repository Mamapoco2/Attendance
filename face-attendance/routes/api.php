<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\FaceController;

Route::post('/register-face', [FaceController::class, 'register']);
Route::post('/recognize-face', [FaceController::class, 'recognize']);
Route::post('/attendance', [FaceController::class, 'attendance']);