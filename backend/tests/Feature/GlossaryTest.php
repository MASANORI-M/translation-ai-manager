<?php

namespace Tests\Feature;

use App\Models\Glossary;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GlossaryTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);
        Http::preventStrayRequests();
    }

    private function path(Project $project): string {
        return "/api/projects/{$project->id}/glossaries";
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array {
        return [...['source_term' => 'Totem of Undying', 'target_term' => '不死のトーテム', 'note' => 'Minecraftのアイテム'], ...$overrides];
    }

    public function test_every_glossary_endpoint_requires_authentication(): void {
        $glossary = Glossary::factory()->create();
        $url = $this->path($glossary->project);
        $this->getJson($url)->assertUnauthorized();
        $this->postJson($url, $this->payload())->assertUnauthorized();
        $this->putJson("$url/{$glossary->id}", $this->payload())->assertUnauthorized();
        $this->deleteJson("$url/{$glossary->id}")->assertUnauthorized();
    }

    public function test_owner_can_create_list_update_and_delete_glossary_including_unchanged_names(): void {
        $project = Project::factory()->create();
        $this->actingAs($project->user, 'web');
        $url = $this->path($project);
        $created = $this->postJson($url, $this->payload(['source_term' => '  Totem of Undying  ']))
            ->assertCreated()->assertJsonPath('data.source_term', 'Totem of Undying')
            ->assertJsonPath('data.project_id', $project->id)->assertJsonMissingPath('data.source_term_key');
        $id = $created->json('data.id');
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.target_term', '不死のトーテム');
        $this->putJson("$url/$id", $this->payload(['note' => null]))->assertOk()->assertJsonPath('data.note', null);
        $this->putJson("$url/$id", $this->payload(['source_term' => 'BABY BLOOP', 'target_term' => 'BABY BLOOP']))
            ->assertOk()->assertJsonPath('data.target_term', 'BABY BLOOP');
        $this->assertSame($project->id, Glossary::findOrFail($id)->project->id);
        $this->assertSame($id, $project->glossaries()->firstOrFail()->id);
        $this->deleteJson("$url/$id")->assertNoContent();
        $this->assertDatabaseMissing('glossaries', ['id' => $id]);
        $this->putJson("$url/$id", $this->payload())->assertNotFound();
        $this->deleteJson("$url/$id")->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_other_owners_cannot_access_glossary_and_parent_mismatches_are_rejected(): void {
        $glossary = Glossary::factory()->create();
        $url = $this->path($glossary->project);
        $this->actingAs(User::factory()->create(), 'web');
        $this->getJson($url)->assertForbidden();
        $this->postJson($url, $this->payload())->assertForbidden();
        $this->putJson("$url/{$glossary->id}", $this->payload())->assertForbidden();
        $this->deleteJson("$url/{$glossary->id}")->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->actingAs($glossary->project->user, 'web');
        $otherProject = Project::factory()->for($glossary->project->user)->create();
        $otherUrl = $this->path($otherProject);
        $this->putJson("$otherUrl/{$glossary->id}", $this->payload())->assertNotFound();
        $this->deleteJson("$otherUrl/{$glossary->id}")->assertNotFound();
        $this->getJson($otherUrl)->assertJsonCount(0, 'data');
        $this->assertDatabaseCount('glossaries', 1);
    }

    public function test_source_term_is_unique_per_project_ignoring_case_and_surrounding_whitespace(): void {
        $project = Project::factory()->create();
        $first = Glossary::factory()->for($project)->create(['source_term' => 'BABY BLOOP']);
        $second = Glossary::factory()->for($project)->create(['source_term' => 'mob']);
        $this->actingAs($project->user, 'web');
        $url = $this->path($project);
        $this->postJson($url, $this->payload(['source_term' => ' baby bloop ']))->assertUnprocessable()->assertJsonValidationErrors('source_term');
        $this->putJson("$url/{$second->id}", $this->payload(['source_term' => 'Baby Bloop']))->assertUnprocessable()->assertJsonValidationErrors('source_term');
        $this->putJson("$url/{$first->id}", $this->payload(['source_term' => 'baby bloop']))->assertOk();
        $otherProject = Project::factory()->for($project->user)->create();
        $this->postJson($this->path($otherProject), $this->payload(['source_term' => 'BABY BLOOP']))->assertCreated();
    }

    public function test_database_enforces_the_unique_source_key(): void {
        $project = Project::factory()->create();
        Glossary::factory()->for($project)->create(['source_term' => 'BABY BLOOP']);
        $this->expectException(QueryException::class);
        Glossary::factory()->for($project)->create(['source_term' => 'baby bloop']);
    }

    public function test_listing_is_paginated_and_deleted_projects_cannot_be_accessed(): void {
        $project = Project::factory()->create();
        $terms = Glossary::factory()->count(21)->for($project)->create();
        Glossary::factory()->create();
        $this->actingAs($project->user, 'web');
        $url = $this->path($project);
        $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 21)->assertJsonPath('data.0.id', $terms->last()->id);
        $this->getJson("$url?page=2")->assertJsonCount(1, 'data');
        $this->getJson("$url?page=0")->assertUnprocessable();
        $this->deleteJson("/api/projects/{$project->id}")->assertNoContent();
        $this->getJson($url)->assertNotFound();
        $this->postJson($url, $this->payload())->assertNotFound();
        $this->putJson("$url/{$terms[0]->id}", $this->payload())->assertNotFound();
        $this->deleteJson("$url/{$terms[0]->id}")->assertNotFound();
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function invalidInputs(): array {
        return [
            'blank source' => [['source_term' => '  '], 'source_term'],
            'long source' => [['source_term' => str_repeat('a', 256)], 'source_term'],
            'invalid source' => [['source_term' => []], 'source_term'],
            'blank target' => [['target_term' => ''], 'target_term'],
            'long target' => [['target_term' => str_repeat('あ', 256)], 'target_term'],
            'invalid target' => [['target_term' => []], 'target_term'],
            'long note' => [['note' => str_repeat('a', 10001)], 'note'],
            'invalid note' => [['note' => []], 'note'],
            'parent injection' => [['project_id' => 999], 'project_id'],
            'key injection' => [['source_term_key' => 'anything'], 'source_term_key'],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_invalid_input_does_not_create_or_modify_glossary(array $overrides, string $field): void {
        $glossary = Glossary::factory()->create(['source_term' => 'mob']);
        $this->actingAs($glossary->project->user, 'web');
        $url = $this->path($glossary->project);
        $this->postJson($url, $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson("$url/{$glossary->id}", $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseCount('glossaries', 1);
        $this->assertSame('mob', $glossary->fresh()->source_term);
    }
}
