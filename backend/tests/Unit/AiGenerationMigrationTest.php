<?php

namespace Tests\Unit;

use Illuminate\Container\Container;
use Illuminate\Database\Capsule\Manager;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\TestCase;

class AiGenerationMigrationTest extends TestCase {
    public function test_migration_unique_selection_constraint_and_rollback_on_sqlite(): void {
        $previous = Facade::getFacadeApplication();
        $container = new Container;
        $database = new Manager($container);
        $database->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $container->instance('db.schema', $database->getConnection()->getSchemaBuilder());
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication($container);
        try {
            $migrations = [];
            foreach (glob(__DIR__.'/../../database/migrations/*.php') as $path) {
                $migration = require $path;
                $migration->up();
                $migrations[] = $migration;
            }
            $this->assertTrue(Schema::hasColumn('segments', 'ai_translation'));
            $this->assertTrue(Schema::hasColumn('segments', 'ai_generation_id'));
            $this->assertTrue(Schema::hasTable('glossaries'));
            $this->assertTrue(Schema::hasColumn('ai_generations', 'glossary_snapshot'));
            $this->assertTrue(Schema::hasColumn('ai_generations', 'segment_context_snapshot'));
            $connection = $database->getConnection();
            $connection->table('users')->insert(['id' => 1, 'name' => 'Test', 'email' => 'test@example.com', 'password' => 'hashed']);
            $connection->table('projects')->insert(['id' => 1, 'user_id' => 1, 'name' => 'Project', 'rate_type' => 'fixed', 'rate' => '0.00', 'currency' => 'USD']);
            $connection->table('scripts')->insert(['id' => 1, 'project_id' => 1, 'title' => 'Script', 'rate_type' => 'fixed', 'rate' => '0.00', 'currency' => 'USD']);
            $connection->table('segments')->insert(['id' => 1, 'script_id' => 1, 'sequence' => 1, 'source_text' => 'Hello']);
            $values = ['segment_id' => 1, 'model' => 'test-model', 'model_name' => 'Test', 'instruction' => 'Translate', 'source_text_snapshot' => 'Hello', 'source_version_snapshot' => 1, 'output' => 'こんにちは', 'input_tokens' => 1, 'output_tokens' => 1, 'total_tokens' => 2, 'usage_details' => '{}', 'pricing_snapshot' => '{}', 'request_settings_snapshot' => '{}', 'cost_status' => 'unknown'];
            $connection->table('ai_generations')->insert($values);
            $this->assertNull($connection->table('ai_generations')->first()->glossary_snapshot);
            $this->assertNull($connection->table('ai_generations')->first()->segment_context_snapshot);
            $connection->table('ai_generations')->insert($values);
            $connection->table('ai_generations')->insert([...$values, 'selected' => true]);
            try {
                $connection->table('ai_generations')->insert([...$values, 'selected' => true]);
                $this->fail('The database must reject two selected generations for one segment.');
            } catch (QueryException) {
                $this->assertSame(1, $connection->table('ai_generations')->where('selected', true)->count());
            }
            foreach (array_reverse($migrations) as $migration) {
                $migration->down();
            }
            $this->assertFalse(Schema::hasTable('ai_generations'));
            $this->assertFalse(Schema::hasTable('glossaries'));
            $this->assertFalse(Schema::hasTable('segments'));
        } finally {
            Facade::clearResolvedInstances();
            Facade::setFacadeApplication($previous);
        }
    }
}
