<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProjectManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:5173']);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        return [...[
            'name' => 'Sample YouTube Project',
            'client_name' => 'Sample Client',
            'description' => 'Project description',
            'translation_style' => '自然な日本語',
            'translation_rules' => "固有名詞を保持\n敬語を使いすぎない",
            'rate_type' => 'per_100_words',
            'rate' => '2.123456',
            'currency' => 'USD',
            'status' => 'active',
        ], ...$overrides];
    }

    public function test_every_project_endpoint_requires_authentication(): void
    {
        $project = Project::factory()->create();
        $this->getJson('/api/projects')->assertUnauthorized();
        $this->postJson('/api/projects', $this->payload())->assertUnauthorized();
        $this->getJson("/api/projects/{$project->id}")->assertUnauthorized();
        $this->putJson("/api/projects/{$project->id}", $this->payload())->assertUnauthorized();
        $this->deleteJson("/api/projects/{$project->id}")->assertUnauthorized();
    }

    public function test_owner_can_create_read_update_and_soft_delete_a_project(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user, 'web');
        $created = $this->postJson('/api/projects', $this->payload(['currency' => ' usd ']))
            ->assertCreated()->assertJsonPath('data.user_id', $user->id)
            ->assertJsonPath('data.rate', '2.123456')->assertJsonPath('data.currency', 'USD');
        $id = $created->json('data.id');
        $this->assertDatabaseHas('projects', ['id' => $id, 'user_id' => $user->id, 'translation_rules' => $this->payload()['translation_rules']]);
        $this->getJson("/api/projects/{$id}")->assertOk()->assertJsonPath('data.name', $this->payload()['name']);
        $this->putJson("/api/projects/{$id}", $this->payload(['name' => 'Updated', 'rate' => '0', 'rate_type' => 'hourly', 'status' => 'paused']))
            ->assertOk()->assertJsonPath('data.name', 'Updated')->assertJsonPath('data.rate', '0.000000')->assertJsonPath('data.status', 'paused');
        $this->deleteJson("/api/projects/{$id}")->assertNoContent();
        $this->assertSoftDeleted('projects', ['id' => $id]);
        $this->getJson("/api/projects/{$id}")->assertNotFound();
        $this->putJson("/api/projects/{$id}", $this->payload())->assertNotFound();
        $this->deleteJson("/api/projects/{$id}")->assertNotFound();
        $this->getJson('/api/projects?include_archived=1')->assertJsonCount(0, 'data');
    }

    public function test_list_contains_only_own_projects_and_is_paginated(): void
    {
        $user = User::factory()->create();
        Project::factory()->count(23)->for($user)->create();
        Project::factory()->count(2)->create();
        $this->actingAs($user, 'web')->getJson('/api/projects')->assertOk()->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.total', 23)->assertJsonPath('meta.last_page', 2);
        $response = $this->getJson('/api/projects?page=2')->assertOk()->assertJsonCount(3, 'data');
        foreach ($response->json('data') as $project) {
            $this->assertSame($user->id, $project['user_id']);
        }
    }

    public function test_archived_projects_are_hidden_by_default_and_can_be_included(): void
    {
        $user = User::factory()->create();
        Project::factory()->for($user)->create(['status' => 'archived']);
        $this->actingAs($user, 'web')->getJson('/api/projects')->assertJsonCount(0, 'data');
        $this->getJson('/api/projects?include_archived=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'archived');
        $this->getJson('/api/projects?page=0')->assertUnprocessable();
        $this->getJson('/api/projects?include_archived=invalid')->assertUnprocessable();
    }

    public function test_other_users_cannot_view_update_or_delete_a_project(): void
    {
        $project = Project::factory()->create();
        $this->actingAs(User::factory()->create(), 'web');
        $this->getJson("/api/projects/{$project->id}")->assertForbidden();
        $this->putJson("/api/projects/{$project->id}", $this->payload(['name' => 'Unauthorized change']))->assertForbidden();
        $this->deleteJson("/api/projects/{$project->id}")->assertForbidden();
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'name' => $project->name, 'deleted_at' => null]);
    }

    public function test_request_cannot_override_ownership_or_model_metadata(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $this->actingAs($user, 'web')->postJson('/api/projects', $this->payload(['user_id' => $other->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $project = Project::factory()->for($user)->create();
        $this->putJson("/api/projects/{$project->id}", $this->payload(['user_id' => $other->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->putJson("/api/projects/{$project->id}", $this->payload(['user_id' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->putJson("/api/projects/{$project->id}", $this->payload(['id' => 9999, 'deleted_at' => '2026-01-01']))->assertOk();
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'user_id' => $user->id, 'deleted_at' => null]);
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function invalidInputs(): array
    {
        return [
            'empty name' => [['name' => '   '], 'name'],
            'long name' => [['name' => str_repeat('a', 256)], 'name'],
            'long client' => [['client_name' => str_repeat('a', 256)], 'client_name'],
            'invalid client' => [['client_name' => []], 'client_name'],
            'long description' => [['description' => str_repeat('a', 10001)], 'description'],
            'invalid style' => [['translation_style' => []], 'translation_style'],
            'long rules' => [['translation_rules' => str_repeat('あ', 10001)], 'translation_rules'],
            'old rate type' => [['rate_type' => 'flat'], 'rate_type'],
            'missing rate' => [['rate' => null], 'rate'],
            'negative rate' => [['rate' => '-1'], 'rate'],
            'non numeric rate' => [['rate' => 'abc'], 'rate'],
            'rate precision overflow' => [['rate' => '0.0000001'], 'rate'],
            'rate integer overflow' => [['rate' => '1000000000000'], 'rate'],
            'scientific notation' => [['rate' => '1e6'], 'rate'],
            'invalid currency' => [['currency' => 'US'], 'currency'],
            'non alphabetic currency' => [['currency' => '123'], 'currency'],
            'invalid status' => [['status' => 'draft'], 'status'],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_validation_rejects_invalid_create_and_update_without_writes(array $overrides, string $field): void
    {
        $user = User::factory()->create();
        $project = Project::factory()->for($user)->create();
        $this->actingAs($user, 'web');
        $this->postJson('/api/projects', $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson("/api/projects/{$project->id}", $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('projects', 1);
        $this->assertDatabaseHas('projects', ['id' => $project->id, 'name' => $project->name]);
    }

    public function test_all_rate_types_statuses_optional_fields_and_maximum_decimal_are_supported(): void
    {
        $this->actingAs(User::factory()->create(), 'web');
        foreach (Project::RATE_TYPES as $index => $rateType) {
            $this->postJson('/api/projects', $this->payload([
                'rate_type' => $rateType, 'status' => Project::STATUSES[$index], 'rate' => '999999999999.999999',
                'client_name' => null, 'description' => null, 'translation_style' => null, 'translation_rules' => null,
            ]))->assertCreated()->assertJsonPath('data.rate', '999999999999.999999')->assertJsonPath('data.client_name', null);
        }
    }
}
