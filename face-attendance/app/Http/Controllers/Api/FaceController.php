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
        $request->validate([
            'name' => 'required|string',
            'employee_number' => 'required|string',
            'images' => 'required|array|min:5|max:10',
            'images.*' => 'required|string',
        ]);

        $response = Http::post('http://127.0.0.1:5001/register', [
            'name' => $request->name,
            'images' => $request->images,
        ]);

        if (!$response->successful()) {
            return response()->json($response->json(), 400);
        }

        $data = $response->json();

        $face = Face::create([
            'name' => $data['name'],
            'employee_number' => $request->employee_number,
            'encoding' => json_encode($data['encoding']),
            'encodings' => json_encode($data['encodings']),
            'image' => $request->images[0],
        ]);

        return response()->json([
            'message' => 'Face saved successfully',
            'name' => $face->name,
            'frames_used' => $data['frames_used'] ?? null,
            'frames_submitted' => $data['frames_submitted'] ?? null,
        ]);
    }

    /* ================= RECOGNIZE ================= */
    public function recognize(Request $request)
    {
        $request->validate([
            'images' => 'required|array|min:3|max:5',
            'images.*' => 'required|string',
        ]);

        $faces = Face::all()->map(function ($face) {
            return [
                'name' => $face->name,
                'encodings' => $face->encodings
                    ? json_decode($face->encodings)
                    : [json_decode($face->encoding)],
            ];
        });

        $response = Http::post('http://127.0.0.1:5001/recognize', [
            'images' => $request->images,
            'known_faces' => $faces,
        ]);

        return response()->json($response->json());
    }

    /* ================= ATTENDANCE (TIME IN / TIME OUT) ================= */
    // Handles shifting/night-shift schedules: e.g. time-in on Aug 2 afternoon,
    // time-out on Aug 3 early morning — records the ACTUAL calendar date of
    // the time-out separately (time_out_date), so the DTR can correctly
    // show arrival under Day 02 and departure under Day 03.
    public function attendance(Request $request)
    {
        $request->validate([
            'name'  => 'required|string',
            'image' => 'nullable|string',
        ]);
 
        $name = $request->name;
        $image = $request->image;
        $face = Face::where('name', $name)->first();
        $employeeNumber = $face?->employee_number;
 
        $timezone = config('app.timezone', 'Asia/Manila');
        $now = Carbon::now($timezone);
        $today = $now->toDateString();
        $currentTime = $now->format('H:i:s');
 
        $windowStart = $now->copy()->subHours(24);
 
        $openAttendance = Attendance::where('name', $name)
            ->whereNotNull('time_in')
            ->whereNull('time_out')
            ->where('date', '>=', $windowStart->toDateString())
            ->orderByDesc('date')
            ->orderByDesc('time_in')
            ->first();
 
        if ($openAttendance) {
            $timeInMoment = Carbon::parse(
                $openAttendance->date . ' ' . $openAttendance->time_in,
                $timezone
            );
            $maxShiftHours = 20;
 
            if ($timeInMoment->diffInHours($now) <= $maxShiftHours) {
                // TIME OUT — record the ACTUAL current date as time_out_date,
                // which may differ from the shift's start date (Day 02 vs Day 03).
                //
                // Explicit attribute assignment + save() instead of a plain
                // ->update([...]) array. This is intentional: mass-assignment
                // silently drops any attribute not listed in the model's
                // $fillable, with no error raised. That silent-drop is exactly
                // what caused time_out_date to stay NULL in production even
                // though this line "set" it. Explicit assignment fails loudly
                // (guarded-attribute exception) instead of failing silently,
                // and is not affected by $fillable at all.
                $openAttendance->time_out = $currentTime;
                $openAttendance->time_out_date = $today;
                $openAttendance->image = $image ?: $openAttendance->image;
                $openAttendance->time_out_image = $image;
                $openAttendance->save();
 
                return response()->json([
                    'type' => 'TIME_OUT',
                    'time_in' => $openAttendance->time_in,
                    'time_out' => $openAttendance->time_out,
                    'time_out_date' => $openAttendance->time_out_date,
                    'message' => "Time Out recorded at $currentTime",
                ]);
            }
        }
 
        $todayAttendance = Attendance::where('name', $name)
            ->where('date', $today)
            ->first();
 
        if ($todayAttendance && $todayAttendance->time_in && $todayAttendance->time_out) {
            return response()->json([
                'type' => 'ALREADY_COMPLETED',
                'message' => 'Attendance already completed for today',
            ]);
        }
 
        // TIME IN — new shift starting now
        $created = new Attendance();
        $created->name = $name;
        $created->employee_number = $employeeNumber;
        $created->date = $today;
        $created->time_in = $currentTime;
        $created->image = $image;
        $created->time_in_image = $image;
        $created->save();
 
        return response()->json([
            'type' => 'TIME_IN',
            'time_in' => $created->time_in,
            'time_out' => $created->time_out,
            'message' => "Time In recorded at $currentTime",
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
                    'time_out_date' => $record->time_out_date,
                    'image' => $record->image,
                    'time_in_image' => $record->time_in_image,
                    'time_out_image' => $record->time_out_image
                ];
            });

        return response()->json($records);
    }

    /* ================= DTR HELPERS ================= */
    /**
     * Build a calendar-day-indexed map of DTR entries for a date range.
     *
     * Unlike a naive "one row per attendance record" approach, this places
     * time_in under the day it actually happened (record's `date`) and
     * time_out under the day IT actually happened (`time_out_date`), which
     * may be the following calendar day for shifting/night schedules.
     *
     * Example: date=2026-08-02, time_in=14:00, time_out_date=2026-08-03,
     * time_out=03:00
     *   -> Day 02: pm_arrival = 14:00
     *   -> Day 03: am_departure = 03:00
     */
    private function buildDtrCalendar($records, Carbon $rangeStart, Carbon $rangeEnd)
    {
        // Seed every day in the range so days with no activity still appear.
        $days = [];
        $cursor = $rangeStart->copy()->startOfDay();
        while ($cursor->lte($rangeEnd)) {
            $key = $cursor->toDateString();
            $days[$key] = [
                'day' => $cursor->day,
                'date' => $key,
                'am_arrival' => null,
                'am_departure' => null,
                'pm_arrival' => null,
                'pm_departure' => null,
            ];
            $cursor->addDay();
        }

        foreach ($records as $record) {
            // ── Place time_in under ITS date ──
            if ($record->time_in) {
                $inDateKey = Carbon::parse($record->date)->toDateString();
                if (isset($days[$inDateKey])) {
                    $inHour = (int) Carbon::parse($record->time_in)->format('H');
                    if ($inHour < 12) {
                        $days[$inDateKey]['am_arrival'] = $record->time_in;
                    } else {
                        $days[$inDateKey]['pm_arrival'] = $record->time_in;
                    }
                }
            }

            // ── Place time_out under time_out_date (falls back to `date`
            //    for older rows that predate this column) ──
            if ($record->time_out) {
                $outDateKey = $record->time_out_date
                    ? Carbon::parse($record->time_out_date)->toDateString()
                    : Carbon::parse($record->date)->toDateString();

                if (isset($days[$outDateKey])) {
                    $outHour = (int) Carbon::parse($record->time_out)->format('H');
                    if ($outHour < 12) {
                        $days[$outDateKey]['am_departure'] = $record->time_out;
                    } else {
                        $days[$outDateKey]['pm_departure'] = $record->time_out;
                    }
                }
            }
        }

        return array_values($days);
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

        $rangeStart = Carbon::create($year, $month, 1)->startOfDay();
        $rangeEnd = $rangeStart->copy()->endOfMonth()->endOfDay();

        // Widen the query by 1 day on each side so cross-midnight shifts
        // at the edges of the month are captured (e.g. time_in on the last
        // day of the previous month with time_out on day 1 of this month).
        $records = Attendance::where('employee_number', $employeeNumber)
            ->whereBetween('date', [
                $rangeStart->copy()->subDay()->toDateString(),
                $rangeEnd->copy()->addDay()->toDateString(),
            ])
            ->orderBy('date')
            ->get();

        $entries = $this->buildDtrCalendar($records, $rangeStart, $rangeEnd);

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

        // Widen query by 1 day on each side for cross-midnight edge shifts.
        $records = Attendance::where('employee_number', $employeeNumber)
            ->whereBetween('date', [
                $leftStart->copy()->subDay()->toDateString(),
                $rightEnd->copy()->addDay()->toDateString(),
            ])
            ->orderBy('date')
            ->get();

        $leftEntries = $this->buildDtrCalendar($records, $leftStart, $leftEnd);
        $rightEntries = $this->buildDtrCalendar($records, $rightStart, $rightEnd);

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