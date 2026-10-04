<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Script;
use App\Models\User;
use App\Services\EstimatedPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ScriptManagementTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array {
        return [...['title' => 'Video #001', 'word_count' => 4500, 'deadline' => '2026-10-10', 'status' => 'pending'], ...$overrides];
    }

    public function test_all_endpoints_require_authentication(): void {
        $script = Script::factory()->create();
        $url = "/api/projects/{$script->project_id}/scripts";
        $this->getJson($url)->assertUnauthorized();
        $this->postJson($url, $this->payload())->assertUnauthorized();
        $this->getJson("$url/{$script->id}")->assertUnauthorized();
        $this->putJson("$url/{$script->id}", $this->payload())->assertUnauthorized();
        $this->deleteJson("$url/{$script->id}")->assertUnauthorized();
    }

    public function test_owner_can_create_list_read_update_and_soft_delete(): void {
        $project = Project::factory()->create(['rate' => '1.80']);
        $url = "/api/projects/{$project->id}/scripts";
        $this->actingAs($project->user, 'web');
        $id = $this->postJson($url, $this->payload())->assertCreated()->assertJsonPath('data.project_id', $project->id)->assertJsonPath('data.estimated_payment', '81.00')->assertJsonPath('data.started_at', null)->json('data.id');
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("$url/$id")->assertOk()->assertJsonPath('data.title', 'Video #001')->assertJsonPath('data.deadline', '2026-10-10');
        $this->putJson("$url/$id", $this->payload(['title' => 'Updated', 'word_count' => 5000, 'status' => 'review', 'deadline' => null]))->assertOk()->assertJsonPath('data.title', 'Updated')->assertJsonPath('data.estimated_payment', '90.00')->assertJsonPath('data.deadline', null);
        $this->deleteJson("$url/$id")->assertNoContent();
        $this->assertSoftDeleted('scripts', ['id' => $id]);
        $this->getJson("$url/$id")->assertNotFound();
        $this->putJson("$url/$id", $this->payload())->assertNotFound();
        $this->deleteJson("$url/$id")->assertNotFound();
        $this->getJson($url)->assertJsonCount(0, 'data');
    }

    public function test_list_is_paginated_and_contains_only_the_requested_project(): void {
        $project = Project::factory()->create();
        Script::factory()->count(23)->for($project)->create();
        Script::factory()->create();
        $this->actingAs($project->user, 'web')->getJson("/api/projects/{$project->id}/scripts")->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 23);
        $this->getJson("/api/projects/{$project->id}/scripts?page=2")->assertJsonCount(3, 'data');
        $this->getJson("/api/projects/{$project->id}/scripts?page=0")->assertUnprocessable();
    }

    public function test_other_users_cannot_access_any_script_endpoint(): void {
        $script = Script::factory()->create();
        $url = "/api/projects/{$script->project_id}/scripts";
        $this->actingAs(User::factory()->create(), 'web');
        $this->getJson($url)->assertForbidden();
        $this->postJson($url, $this->payload())->assertForbidden();
        $this->getJson("$url/{$script->id}")->assertForbidden();
        $this->putJson("$url/{$script->id}", $this->payload())->assertForbidden();
        $this->deleteJson("$url/{$script->id}")->assertForbidden();
        $this->assertDatabaseHas('scripts', ['id' => $script->id, 'deleted_at' => null]);
    }

    public function test_wrong_parent_is_rejected_even_when_both_projects_have_the_same_owner(): void {
        $project = Project::factory()->create();
        $other = Project::factory()->for($project->user)->create();
        $script = Script::factory()->for($other)->create();
        $this->actingAs($project->user, 'web');
        $url = "/api/projects/{$project->id}/scripts/{$script->id}";
        $this->getJson($url)->assertNotFound();
        $this->putJson($url, $this->payload())->assertNotFound();
        $this->deleteJson($url)->assertNotFound();
        $foreign = Script::factory()->create();
        $this->getJson("/api/projects/{$project->id}/scripts/{$foreign->id}")->assertNotFound();
        $this->putJson("/api/projects/{$project->id}/scripts/{$foreign->id}", $this->payload())->assertNotFound();
        $this->deleteJson("/api/projects/{$project->id}/scripts/{$foreign->id}")->assertNotFound();
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function invalidInputs(): array {
        return [
            'empty title' => [['title' => '  '], 'title'], 'long title' => [['title' => str_repeat('a', 256)], 'title'],
            'missing words' => [['word_count' => null], 'word_count'], 'negative words' => [['word_count' => -1], 'word_count'], 'fractional words' => [['word_count' => 1.5], 'word_count'], 'overflow' => [['word_count' => 4294967296], 'word_count'],
            'invalid date' => [['deadline' => '2026-02-30'], 'deadline'], 'invalid status' => [['status' => 'draft'], 'status'], 'invalid start' => [['started_at' => 'invalid'], 'started_at'], 'invalid completion' => [['completed_at' => 'invalid'], 'completed_at'],
            'parent override' => [['project_id' => 10], 'project_id'], 'owner override' => [['user_id' => 10], 'user_id'], 'rate override' => [['rate' => '99'], 'rate'], 'currency override' => [['currency' => 'JPY'], 'currency'], 'type override' => [['rate_type' => 'fixed'], 'rate_type'],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_create_and_update_do_not_write(array $overrides, string $field): void {
        $script = Script::factory()->create();
        $url = "/api/projects/{$script->project_id}/scripts";
        $this->actingAs($script->project->user, 'web');
        $this->postJson($url, $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson("$url/{$script->id}", $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('scripts', 1);
        $this->assertDatabaseHas('scripts', ['id' => $script->id, 'title' => $script->title]);
    }

    /** @return array<string, array{string, string, int, string, ?string}> */
    public static function payments(): array {
        return [
            'per 100' => ['per_100_words', '1.80', 4500, 'USD', '81.00'], 'per word' => ['per_word', '0.02', 4500, 'USD', '90.00'], 'fixed' => ['fixed', '123.456', 0, 'USD', '123.46'], 'hourly' => ['hourly', '20', 4500, 'USD', null],
            'zero' => ['per_word', '1.80', 0, 'USD', '0.00'], 'half cent' => ['per_100_words', '0.50', 1, 'USD', '0.01'], 'JPY' => ['per_word', '0.50', 1, 'JPY', '1'], 'three digits' => ['fixed', '1.2345', 0, 'KWD', '1.235'],
        ];
    }

    #[DataProvider('payments')]
    public function test_payment_is_precise(string $type, string $rate, int $words, string $currency, ?string $expected): void {
        $project = Project::factory()->create(['rate_type' => $type, 'rate' => $rate, 'currency' => $currency]);
        $this->actingAs($project->user, 'web')->postJson("/api/projects/{$project->id}/scripts", $this->payload(['word_count' => $words]))->assertCreated()->assertJsonPath('data.estimated_payment', $expected);
    }

    public function test_maximum_decimal_payment_without_sqlite_numeric_coercion(): void {
        $script = new Script(['rate_type' => 'per_word', 'rate' => '999999999999.999999', 'word_count' => 4294967295, 'currency' => 'USD']);
        $this->assertSame('4294967294999999995705.03', app(EstimatedPayment::class)->calculate($script));
    }

    public function test_project_rate_changes_preserve_existing_contract_and_new_scripts_use_current_rate(): void {
        $project = Project::factory()->create(['rate' => '1.80']);
        $url = "/api/projects/{$project->id}/scripts";
        $this->actingAs($project->user, 'web');
        $id = $this->postJson($url, $this->payload())->assertCreated()->json('data.id');
        $project->update(['rate' => '2.00']);
        $this->getJson("$url/$id")->assertJsonPath('data.estimated_payment', '81.00');
        $this->putJson("$url/$id", $this->payload(['word_count' => 5000]))->assertJsonPath('data.estimated_payment', '90.00');
        $this->postJson($url, $this->payload())->assertJsonPath('data.estimated_payment', '90.00');
    }

    public function test_status_dates_are_automatic_preserved_and_cleared_on_reopening(): void {
        $script = Script::factory()->create();
        $this->actingAs($script->project->user, 'web');
        $url = "/api/projects/{$script->project_id}/scripts/{$script->id}";
        $this->travelTo(now()->startOfSecond());
        $start = $this->putJson($url, $this->payload(['status' => 'in_progress']))->assertOk()->json('data.started_at');
        $this->assertNotNull($start);
        $this->travel(1)->hours();
        $this->putJson($url, $this->payload(['status' => 'review']))->assertJsonPath('data.started_at', $start)->assertJsonPath('data.completed_at', null);
        $completion = $this->putJson($url, $this->payload(['status' => 'completed']))->json('data.completed_at');
        $this->assertNotNull($completion);
        $this->travel(1)->hours();
        $this->putJson($url, $this->payload(['status' => 'completed']))->assertJsonPath('data.completed_at', $completion);
        $this->putJson($url, $this->payload(['status' => 'in_progress']))->assertJsonPath('data.started_at', $start)->assertJsonPath('data.completed_at', null);
        $this->putJson($url, $this->payload(['status' => 'completed']))->assertJsonPath('data.completed_at', now()->toISOString());
    }

    public function test_explicit_dates_and_creation_in_progress_or_completed_are_supported(): void {
        $project = Project::factory()->create();
        $this->actingAs($project->user, 'web');
        $url = "/api/projects/{$project->id}/scripts";
        $this->postJson($url, $this->payload(['status' => 'in_progress']))->assertCreated()->assertJsonPath('data.started_at', now()->startOfSecond()->toISOString());
        $this->postJson($url, $this->payload(['status' => 'completed', 'started_at' => '2026-01-01T00:00:00Z', 'completed_at' => '2026-01-02T00:00:00Z']))->assertCreated()->assertJsonPath('data.started_at', '2026-01-01T00:00:00.000000Z')->assertJsonPath('data.completed_at', '2026-01-02T00:00:00.000000Z');
    }

    public function test_project_deletion_soft_deletes_scripts_and_blocks_all_nested_access(): void {
        $script = Script::factory()->create();
        $project = $script->project;
        $this->actingAs($project->user, 'web');
        $this->deleteJson("/api/projects/{$project->id}")->assertNoContent();
        $this->assertSoftDeleted('scripts', ['id' => $script->id]);
        $url = "/api/projects/{$project->id}/scripts";
        $this->getJson($url)->assertNotFound();
        $this->postJson($url, $this->payload())->assertNotFound();
        $this->getJson("$url/{$script->id}")->assertNotFound();
        $this->putJson("$url/{$script->id}", $this->payload())->assertNotFound();
        $this->deleteJson("$url/{$script->id}")->assertNotFound();
    }
}
