<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Services\AuditLogger;
use App\Services\Realtime;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(\Illuminate\Http\Request $request)
    {
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 15);
        $perPage = max(1, min($perPage, 50));

        $users = User::orderBy('created_at')->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'message' => 'Users retrieved successfully',
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'has_more' => $users->hasMorePages(),
            ],
        ]);
    }

    public function store(StoreUserRequest $request)
    {
        $data = $request->validated();

        $user = User::create($data);

        Realtime::push('users', ['type' => 'user.changed']);
        AuditLogger::record(
            'created',
            'user',
            $user->id,
            'Akun ' . $user->name . ' (' . $user->role . ') dibuat'
        );

        return response()->json([
            'message' => 'User created successfully',
            'data' => $user,
        ], 201);
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $data = $request->validated();

        if ($user->role === 'admin'
            && isset($data['role'])
            && $data['role'] !== 'admin'
            && User::where('role', 'admin')->count() <= 1
        ) {
            return response()->json([
                'message' => 'Tidak dapat mengubah peran admin terakhir.',
            ], 422);
        }

        $user->update($data);

        Realtime::push('users', ['type' => 'user.changed']);
        AuditLogger::record(
            'updated',
            'user',
            $user->id,
            'Akun ' . $user->name . ' diperbarui'
        );

        return response()->json([
            'message' => 'User updated successfully',
            'data' => $user,
        ]);
    }

    public function destroy(Request $request, User $user)
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Anda tidak dapat menghapus akun sendiri.',
            ], 422);
        }

        if ($user->role === 'admin' && User::where('role', 'admin')->count() <= 1) {
            return response()->json([
                'message' => 'Tidak dapat menghapus admin terakhir.',
            ], 422);
        }

        $user->delete();

        Realtime::push('users', ['type' => 'user.changed']);
        AuditLogger::record(
            'deleted',
            'user',
            $user->id,
            'Akun ' . $user->name . ' dihapus'
        );

        return response()->json([
            'message' => 'User deleted successfully',
        ]);
    }
}