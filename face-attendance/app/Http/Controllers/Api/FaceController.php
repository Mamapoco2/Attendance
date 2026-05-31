<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Http\Controllers\Controller;
use App\Models\Face;
use App\Models\Attendance;
use Carbon\Carbon;

class FaceController extends Controller
{
    /* ================= REGISTER ================= */
    public function register(Request $request)
    {
        $response = Http::post('http://127.0.0.1:5001/register', [
            'name' => $request->name,
            'image' => $request->image
        ]);

        if (!$response->successful()) {
            return response()->json($response->json(), 400);
        }

        $data = $response->json();

        $face = Face::create([
            'name' => $data['name'],
            'employee_number' => $request->employee_number,
            'encoding' => json_encode($data['encoding']),
            'image' => $request->image
        ]);

        return response()->json([
            'message' => 'Face saved successfully',
            'name' => $face->name
        ]);
    }

    /* ================= RECOGNIZE ================= */
    public function recognize(Request $request)
    {
        $faces = Face::all()->map(function ($face) {
            return [
                'name' => $face->name,
                'encoding' => json_decode($face->encoding)
            ];
        });

        $response = Http::post('http://127.0.0.1:5001/recognize', [
            'image' => $request->image,
            'known_faces' => $faces
        ]);

        return response()->json($response->json());
    }

    public function attendance(Request $request)
{
    $name = $request->name;
    $image = $request->image;
    $face = Face::where('name', $name)->first();
    $employeeNumber = $face?->employee_number;

    $timezone = config('app.timezone', 'Asia/Manila');
    $now = Carbon::now($timezone);
    $today = $now->toDateString();
    $currentTime = $now->format('H:i:s');

    $attendance = Attendance::where('name', $name)
        ->where('date', $today)
        ->first();

    if (!$attendance) {
        // TIME IN
        $created = Attendance::create([
            'name' => $name,
            'employee_number' => $employeeNumber,
            'date' => $today,
            'time_in' => $currentTime,
            'image' => $image,
            'time_in_image' => $image
        ]);

        return response()->json([
            'type' => 'TIME_IN',
            'time_in' => $created->time_in,
            'time_out' => $created->time_out,
            'message' => "Time In recorded at $currentTime"
        ]);
    }

    if ($attendance->time_in && !$attendance->time_out) {
        // TIME OUT
        $attendance->update([
            'time_out' => $currentTime,
            'image' => $image ?: $attendance->image,
            'time_out_image' => $image
        ]);

        return response()->json([
            'type' => 'TIME_OUT',
            'time_in' => $attendance->time_in,
            'time_out' => $attendance->time_out,
            'message' => "Time Out recorded at $currentTime"
        ]);
    }

    return response()->json([
        'type' => 'ALREADY_COMPLETED',
        'message' => 'Attendance already completed for today'
    ]);
}

public function attendanceRecords()
{
    $records = Attendance::orderByDesc('date')
        ->orderByDesc('created_at')
        ->get()
        ->map(function ($record) {
            return [
                'id' => $record->id,
                'name' => $record->name,
                'employee_number' => $record->employee_number,
                'date' => $record->date,
                'time_in' => $record->time_in,
                'time_out' => $record->time_out,
                'image' => $record->image,
                'time_in_image' => $record->time_in_image,
                'time_out_image' => $record->time_out_image
            ];
        });

    return response()->json($records);
}

public function employeeDtr(Request $request)
{
    $employeeNumber = $request->query('employee_number');
    $month = (int) $request->query('month', Carbon::now()->month);
    $year = (int) $request->query('year', Carbon::now()->year);

    if (!$employeeNumber) {
        return response()->json(['message' => 'employee_number is required'], 422);
    }

    $face = Face::where('employee_number', $employeeNumber)->first();
    if (!$face) {
        return response()->json([
            'employee' => null,
            'entries' => [],
            'month' => $month,
            'year' => $year
        ]);
    }

    $records = Attendance::where('employee_number', $employeeNumber)
        ->whereYear('date', $year)
        ->whereMonth('date', $month)
        ->orderBy('date')
        ->get();

    $entries = $records->map(function ($record) {
        return [
            'day' => Carbon::parse($record->date)->day,
            'date' => $record->date,
            'am_arrival' => $record->time_in,
            'am_departure' => null,
            'pm_arrival' => null,
            'pm_departure' => $record->time_out,
        ];
    });

    return response()->json([
        'employee' => [
            'name' => $face->name,
            'employee_number' => $face->employee_number,
        ],
        'entries' => $entries,
        'month' => $month,
        'year' => $year
    ]);
}

public function employeeDtrCutoff(Request $request)
{
    $employeeNumber = $request->query('employee_number');
    $month = (int) $request->query('month', Carbon::now()->month);
    $year = (int) $request->query('year', Carbon::now()->year);

    if (!$employeeNumber) {
        return response()->json(['message' => 'employee_number is required'], 422);
    }

    $face = Face::where('employee_number', $employeeNumber)->first();
    if (!$face) {
        return response()->json([
            'employee' => null,
            'left_range' => null,
            'right_range' => null,
            'left_entries' => [],
            'right_entries' => [],
        ]);
    }

    $rightStart = Carbon::create($year, $month, 1)->startOfDay();
    $rightEnd = Carbon::create($year, $month, 25)->endOfDay();
    $leftStart = (clone $rightStart)->subMonthNoOverflow()->day(26)->startOfDay();
    $leftEnd = (clone $leftStart)->endOfMonth()->endOfDay();

    $records = Attendance::where('employee_number', $employeeNumber)
        ->whereBetween('date', [$leftStart->toDateString(), $rightEnd->toDateString()])
        ->orderBy('date')
        ->get();

    $toEntry = function ($record) {
        return [
            'day' => Carbon::parse($record->date)->day,
            'date' => $record->date,
            'am_arrival' => $record->time_in,
            'am_departure' => null,
            'pm_arrival' => null,
            'pm_departure' => $record->time_out,
        ];
    };

    $leftEntries = $records->filter(function ($record) use ($leftStart, $leftEnd) {
        $date = Carbon::parse($record->date);
        return $date->betweenIncluded($leftStart, $leftEnd);
    })->values()->map($toEntry);

    $rightEntries = $records->filter(function ($record) use ($rightStart, $rightEnd) {
        $date = Carbon::parse($record->date);
        return $date->betweenIncluded($rightStart, $rightEnd);
    })->values()->map($toEntry);

    return response()->json([
        'employee' => [
            'name' => $face->name,
            'employee_number' => $face->employee_number,
        ],
        'left_range' => [
            'start' => $leftStart->toDateString(),
            'end' => $leftEnd->toDateString(),
        ],
        'right_range' => [
            'start' => $rightStart->toDateString(),
            'end' => $rightEnd->toDateString(),
        ],
        'left_entries' => $leftEntries,
        'right_entries' => $rightEntries,
    ]);
}
}