<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Adds 'time_out_date' so a shift's departure can be recorded on its
     * OWN calendar day, separate from 'date' (which represents the
     * time_in's day). Needed for shifting schedules, e.g.:
     *   date = 2026-08-02, time_in = 14:00:00
     *   time_out_date = 2026-08-03, time_out = 03:00:00
     * This lets the DTR correctly show the departure under Day 03
     * instead of lumping it into Day 02's row.
     */
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (!Schema::hasColumn('attendances', 'time_out_date')) {
                $table->date('time_out_date')->nullable()->after('date');
            }
        });

        // Backfill: for existing rows with a time_out already set, assume
        // it happened on the same date as time_in (best guess for old data
        // that didn't track shifting schedules yet).
        DB::table('attendances')
            ->whereNotNull('time_out')
            ->whereNull('time_out_date')
            ->update(['time_out_date' => DB::raw('`date`')]);
    }

    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            if (Schema::hasColumn('attendances', 'time_out_date')) {
                $table->dropColumn('time_out_date');
            }
        });
    }
};