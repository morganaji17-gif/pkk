<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Http\Requests\AuditLog\IndexAuditLogRequest;

class AuditLogController extends Controller
{
    public function index(IndexAuditLogRequest $request)
    {
        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 15);

        $logs = AuditLog::with('user')
            ->when($request->filled('resource_type'), function ($query) use ($request) {
                $query->where('resource_type', $request->input('resource_type'));
            })
            ->when($request->filled('action'), function ($query) use ($request) {
                $query->where('action', $request->input('action'));
            })
            ->when($request->filled('user_id'), function ($query) use ($request) {
                $query->where('user_id', $request->input('user_id'));
            })
            ->when($request->filled('from'), function ($query) use ($request) {
                $query->where('created_at', '>=', $request->input('from') . ' 00:00:00');
            })
            ->when($request->filled('to'), function ($query) use ($request) {
                $query->where('created_at', '<=', $request->input('to') . ' 23:59:59');
            })
            ->when($request->filled('search'), function ($query) use ($request) {
                $query->where('description', 'like', '%' . trim($request->input('search')) . '%');
            })
            ->latest('created_at')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'message' => 'Audit logs retrieved successfully',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'has_more' => $logs->hasMorePages(),
            ],
        ]);
    }
}