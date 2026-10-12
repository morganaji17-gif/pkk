<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockMutation;
use App\Http\Requests\StockMutation\IndexStockMutationRequest;

class StockMutationController extends Controller
{
    public function index(IndexStockMutationRequest $request)
    {
        $page = $request->integer('page', 1);
        $perPage = $request->integer('per_page', 15);

        $mutations = StockMutation::with(['product', 'order', 'user'])
            ->join('products', 'products.id', '=', 'stock_mutations.product_id')
            ->when($request->filled('product_id'), function ($query) use ($request) {
                $query->where('stock_mutations.product_id', $request->input('product_id'));
            })
            ->when($request->filled('reason'), function ($query) use ($request) {
                $query->where('stock_mutations.reason', $request->input('reason'));
            })
            ->when($request->filled('from'), function ($query) use ($request) {
                $query->where('stock_mutations.created_at', '>=', $request->input('from') . ' 00:00:00');
            })
            ->when($request->filled('to'), function ($query) use ($request) {
                $query->where('stock_mutations.created_at', '<=', $request->input('to') . ' 23:59:59');
            })
            ->when($request->filled('search'), function ($query) use ($request) {
                $query->where('products.name', 'like', '%' . trim($request->input('search')) . '%');
            })
            ->orderBy('stock_mutations.created_at', 'desc')
            ->orderBy('stock_mutations.id', 'desc')
            ->paginate($perPage, ['stock_mutations.*'], 'page', $page);

        return response()->json([
            'message' => 'Stock mutations retrieved successfully',
            'data' => $mutations->items(),
            'meta' => [
                'current_page' => $mutations->currentPage(),
                'last_page' => $mutations->lastPage(),
                'per_page' => $mutations->perPage(),
                'total' => $mutations->total(),
                'has_more' => $mutations->hasMorePages(),
            ],
        ]);
    }
}