<?php

namespace Database\Seeders;
 
use Illuminate\Database\Seeder;
use App\Models\Face;
use App\Models\Attendance;
use Carbon\Carbon;
 
class SampleShiftingAttendanceSeeder extends Seeder
{
    public function run(): void
    {
        $name = 'Juan Dela Cruz';
        $employeeNumber = 'EMP-0001';
 
        // ── 1. Ensure a matching Face record exists ────────────────────────
        $dummyEncoding = array_fill(0, 128, 0.0); // 128-dim placeholder vector
 
        Face::updateOrCreate(
            ['employee_number' => $employeeNumber],
            [
                'name' => $name,
                'encoding' => json_encode($dummyEncoding),
                'encodings' => json_encode([$dummyEncoding]),
                'image' => null,
            ]
        );
 
        // ── 2. Create the sample "open shift" Attendance record ────────────
        $timezone = config('app.timezone', 'Asia/Manila');
        $yesterday = Carbon::yesterday($timezone);
 
        Attendance::updateOrCreate(
            [
                'name' => $name,
                'date' => $yesterday->toDateString(),
            ],
            [
                'employee_number' => $employeeNumber,
                'time_in' => '14:00:00',   // afternoon arrival, e.g. 2:00 PM
                'time_out' => null,        // still open
                'image' => null,
                'time_in_image' => null,
                'time_out_image' => null,
            ]
        );
 
        $this->command->info(
            "Sample Face + open shift created for {$name} ({$employeeNumber}) " .
            "on {$yesterday->toDateString()} at 14:00. Now hit /attendance again " .
            "this morning with the same name to test TIME_OUT completion."
        );
    }
}