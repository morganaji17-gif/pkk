<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('realtime_events') && ! $this->indexExists('realtime_events_channel_id_index')) {
            Schema::table('realtime_events', function (Blueprint $table) {
                $table->index(['channel', 'id'], 'realtime_events_channel_id_index');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('realtime_events') && $this->indexExists('realtime_events_channel_id_index')) {
            Schema::table('realtime_events', function (Blueprint $table) {
                $table->dropIndex('realtime_events_channel_id_index');
            });
        }
    }

    private function indexExists(string $index): bool
    {
        $driver = DB::connection()->getDriverName();
        if ($driver === 'sqlite') {
            $row = DB::selectOne(
                "select count(*) as aggregate from sqlite_master where type = 'index' and name = ?",
                [$index],
            );

            return ((int) ($row->aggregate ?? 0)) > 0;
        }

        return DB::selectOne(
            'select count(*) as aggregate from information_schema.statistics where table_schema = database() and table_name = ? and index_name = ?',
            ['realtime_events', $index],
        )->aggregate > 0;
    }
};
