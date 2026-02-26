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
            'encoding' => json_encode($data['encoding'])
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

    $today = Carbon::today()->toDateString();
    $now = Carbon::now()->format('H:i:s');

    $attendance = Attendance::where('name', $name)
        ->where('date', $today)
        ->first();

    if (!$attendance) {
        // TIME IN
        Attendance::create([
            'name' => $name,
            'date' => $today,
            'time_in' => $now
        ]);

        return response()->json([
            'type' => 'TIME_IN',
            'message' => "Time In recorded at $now"
        ]);
    }

    if ($attendance->time_in && !$attendance->time_out) {
        // TIME OUT
        $attendance->update([
            'time_out' => $now
        ]);

        return response()->json([
            'type' => 'TIME_OUT',
            'message' => "Time Out recorded at $now"
        ]);
    }

    return response()->json([
        'type' => 'ALREADY_COMPLETED',
        'message' => 'Attendance already completed for today'
    ]);
}
}