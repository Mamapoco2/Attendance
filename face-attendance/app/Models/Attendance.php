<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $fillable = [
    'name',
    'employee_number',
    'date',
    'time_in',
    'time_out',
    'image',
    'time_in_image',
    'time_out_image'
];
}