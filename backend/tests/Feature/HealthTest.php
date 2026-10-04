<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use PDOException;
use Tests\TestCase;

class HealthTest extends TestCase {
    public function test_health_checks_database_connectivity(): void {
        DB::shouldReceive('select')->once()->with('SELECT 1')->andReturn([]);

        $this->getJson('/api/health')->assertOk()->assertExactJson([
            'status' => 'ok',
            'database' => 'connected',
        ]);
    }

    public function test_health_returns_service_unavailable_when_database_is_unreachable(): void {
        DB::shouldReceive('select')->once()->with('SELECT 1')->andThrow(
            new QueryException('mysql', 'SELECT 1', [], new PDOException('Database unavailable')),
        );

        $this->getJson('/api/health')->assertStatus(503)->assertExactJson([
            'status' => 'error',
            'database' => 'disconnected',
        ]);
    }
}
