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
            $table->longText('image')->nullable()->after('encoding');
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->longText('image')->nullable()->after('time_out');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn('image');
        });

        Schema::table('faces', function (Blueprint $table) {
            $table->dropColumn('image');
        });
    }
};
