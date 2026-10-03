<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ScriptController;
use App\Http\Controllers\SegmentController;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function (): JsonResponse {
    try {
        DB::select('SELECT 1');
    } catch (QueryException) {
        return response()->json([
            'status' => 'error',
            'database' => 'disconnected',
        ], 503);
    }

    return response()->json([
        'status' => 'ok',
        'database' => 'connected',
    ]);
});

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:registration');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/user', [AuthController::class, 'user'])->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::apiResource('projects.scripts.segments', SegmentController::class)->only(['index', 'store', 'show', 'update', 'destroy'])->whereNumber(['project', 'script', 'segment']);
    Route::apiResource('projects.scripts', ScriptController::class)->only(['index', 'store', 'show', 'update', 'destroy'])->whereNumber(['project', 'script']);
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show'])->whereNumber('project');
    Route::put('/projects/{project}', [ProjectController::class, 'update'])->whereNumber('project');
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->whereNumber('project');
});
