<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Attendance extends Model
{
    use HasFactory;

    /**
     * Mass-assignable attributes.
     *
     * IMPORTANT: time_out_date, time_in_image, time_out_image were
     * previously missing here. Laravel silently drops any attribute
     * passed to create()/update() that isn't listed in $fillable —
     * no exception, no warning, it just never gets saved. This was the
     * root cause of night-shift time-outs losing their calendar date
     * (time_out_date stayed NULL even though the controller explicitly
     * set it).
     *
     * NOTE: intentionally NOT adding attribute casts here for
     * date/time_in/time_out. The existing FaceController code does raw
     * string concatenation (e.g. `$record->date . ' ' . $record->time_in`)
     * and Carbon::parse() on these values as plain strings. Adding casts
     * would silently change their runtime type and could break that
     * logic elsewhere. Keep this fix scoped to the actual bug.
     */
    protected $fillable = [
        'name',
        'employee_number',
        'date',
        'time_in',
        'time_out',
        'time_out_date',
        'image',
        'time_in_image',
        'time_out_image',
    ];
}