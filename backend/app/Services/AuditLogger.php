<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLogger
{
    public static function record(
        string $action,
        string $resourceType,
        int|string|null $resourceId = null,
        string $description = null,
        array $oldData = null,
        array $newData = null
    ): void {
        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'description' => $description,
            'old_data' => $oldData,
            'new_data' => $newData,
            'ip' => Request::ip(),
            'created_at' => now(),
        ]);
    }
}