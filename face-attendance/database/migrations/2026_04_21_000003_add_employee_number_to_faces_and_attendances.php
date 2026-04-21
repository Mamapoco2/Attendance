<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('faces', function (Blueprint $table) {
            $table->string('employee_number')->nullable()->after('name');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->string('employee_number')->nullable()->after('name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn('employee_number');
        });

        Schema::table('faces', function (Blueprint $table) {
            $table->dropColumn('employee_number');
        });
    }
};
