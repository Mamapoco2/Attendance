<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendance extends Model
{
    protected $fillable = [
    'name',
    'date',
    'time_in',
    'time_out'
];
}