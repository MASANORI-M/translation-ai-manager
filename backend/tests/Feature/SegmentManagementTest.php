<?php

namespace Tests\Feature;

use App\Models\Script;
use App\Models\Segment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SegmentManagementTest extends TestCase {
    use RefreshDatabase;

    protected function setUp(): void {
        parent::setUp();
        $this->withHeaders(['Origin' => 'http://localhost:3000']);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array {
        return [...[
            'sequence' => 1,
            'timecode_start' => '00:26:58',
            'timecode_end' => '00:27:06',
            'emotion' => 'Terrified / Excited',
            'source_text' => 'HOLY... LOOK AT THE SIZE OF THAT THING!',
            'final_translation' => null,
            'memo' => null,
            'status' => 'pending',
        ], ...$overrides];
    }

    public function test_all_segment_endpoints_require_authentication(): void {
        $segment = Segment::factory()->create();
        $base = "/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}/segments";
        $this->getJson($base)->assertUnauthorized();
        $this->postJson($base, $this->payload())->assertUnauthorized();
        $this->getJson("$base/{$segment->id}")->assertUnauthorized();
        $this->putJson("$base/{$segment->id}", $this->payload(['version' => 1]))->assertUnauthorized();
        $this->deleteJson("$base/{$segment->id}")->assertUnauthorized();
    }

    public function test_create_list_read_update_delete_word_count_and_progress(): void {
        $script = Script::factory()->create(['word_count' => 10, 'rate' => '1.800000']);
        $this->actingAs($script->project->user, 'web');
        $base = "/api/projects/{$script->project_id}/scripts/{$script->id}/segments";
        $second = $this->postJson($base, $this->payload(['sequence' => 2, 'source_text' => 'Second line.']))->assertCreated()->json('data');
        $this->assertSame('00:26:58', $second['timecode_start']);
        $this->assertSame('00:27:06', $second['timecode_end']);
        $this->assertNull($second['ai_translation']);
        $this->assertSame(1, $second['version']);
        $this->assertSame(1, $second['source_version']);
        $first = $this->postJson($base, $this->payload(['sequence' => 1]))->assertCreated()->json('data');
        $this->assertSame(10, $this->getJson("/api/projects/{$script->project_id}/scripts/{$script->id}")->json('data.word_count'));
        $this->putJson("/api/projects/{$script->project_id}/scripts/{$script->id}", ['title' => $script->title, 'word_count' => 999, 'deadline' => null, 'status' => 'pending'])->assertOk()->assertJsonPath('data.word_count', 10);
        $this->getJson($base)->assertOk()->assertJsonPath('data.0.sequence', 1)->assertJsonPath('data.1.sequence', 2);
        $url = "$base/{$first['id']}";
        $this->getJson($url)->assertOk()->assertJsonPath('data.emotion', 'Terrified / Excited');
        $saved = $this->putJson($url, $this->payload(['version' => 1, 'status' => 'completed', 'final_translation' => '大きすぎる！']))
            ->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.version', 2)->json('data');
        $this->assertSame(1, $saved['final_source_version']);
        $this->getJson("/api/projects/{$script->project_id}/scripts/{$script->id}")->assertJsonPath('data.progress.completed', 1)->assertJsonPath('data.progress.total', 2);
        $this->putJson($url, $this->payload(['version' => 2, 'status' => 'editing', 'final_translation' => '大きすぎる！']))->assertJsonPath('data.status', 'editing');
        $this->putJson($url, $this->payload(['version' => 3, 'status' => 'completed', 'final_translation' => '大きすぎる！']))->assertJsonPath('data.status', 'completed');
        $this->deleteJson("$base/{$second['id']}")->assertNoContent();
        $this->assertSoftDeleted('segments', ['id' => $second['id']]);
        $this->getJson("$base/{$second['id']}")->assertNotFound();
        $this->getJson("/api/projects/{$script->project_id}/scripts/{$script->id}")->assertJsonPath('data.word_count', 8)->assertJsonPath('data.progress.total', 1);
    }

    public function test_editor_pages_segments_in_ascending_sequence(): void {
        $script = Script::factory()->create();
        foreach (range(1, 23) as $sequence) {
            Segment::factory()->for($script)->create(['sequence' => $sequence]);
        }
        $base = "/api/projects/{$script->project_id}/scripts/{$script->id}/segments";
        $this->actingAs($script->project->user, 'web');
        $this->getJson($base)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('data.0.sequence', 1)->assertJsonPath('data.19.sequence', 20)->assertJsonPath('meta.total', 23);
        $this->getJson("$base?page=2")->assertJsonCount(3, 'data')->assertJsonPath('data.0.sequence', 21);
        $this->getJson("$base?page=0")->assertUnprocessable();
    }

    public function test_sequences_are_unique_including_soft_deleted_and_can_be_reused_in_other_scripts(): void {
        $script = Script::factory()->create();
        $other = Script::factory()->for($script->project)->create();
        $this->actingAs($script->project->user, 'web');
        $base = "/api/projects/{$script->project_id}/scripts/{$script->id}/segments";
        $id = $this->postJson($base, $this->payload())->assertCreated()->json('data.id');
        $this->postJson($base, $this->payload())->assertUnprocessable()->assertJsonValidationErrors('sequence');
        $this->postJson("/api/projects/{$script->project_id}/scripts/{$other->id}/segments", $this->payload())->assertCreated();
        $this->deleteJson("$base/$id")->assertNoContent();
        $this->postJson($base, $this->payload())->assertUnprocessable()->assertJsonValidationErrors('sequence');
    }

    public function test_other_users_and_wrong_parent_combinations_cannot_access_segments(): void {
        $segment = Segment::factory()->create();
        $owner = $segment->script->project->user;
        $foreign = Segment::factory()->create();
        $otherScript = Script::factory()->for($segment->script->project)->create();
        $base = "/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}/segments";
        $this->actingAs(User::factory()->create(), 'web');
        $this->getJson($base)->assertForbidden();
        $this->postJson($base, $this->payload())->assertForbidden();
        $this->getJson("$base/{$segment->id}")->assertForbidden();
        $this->putJson("$base/{$segment->id}", $this->payload(['version' => 1]))->assertForbidden();
        $this->deleteJson("$base/{$segment->id}")->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->actingAs($owner, 'web');
        foreach (["$base/{$foreign->id}", "/api/projects/{$segment->script->project_id}/scripts/{$otherScript->id}/segments/{$segment->id}"] as $url) {
            $this->assertSame(404, $this->getJson($url)->status(), $url);
            $this->putJson($url, $this->payload(['version' => 1]))->assertNotFound();
            $this->deleteJson($url)->assertNotFound();
        }
        $foreignParent = "/api/projects/{$foreign->script->project_id}/scripts/{$segment->script_id}/segments/{$segment->id}";
        $this->getJson($foreignParent)->assertForbidden();
        $this->putJson($foreignParent, $this->payload(['version' => 1]))->assertForbidden();
        $this->deleteJson($foreignParent)->assertForbidden();
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function invalidInputs(): array {
        return [
            'zero sequence' => [['sequence' => 0], 'sequence'],
            'fractional sequence' => [['sequence' => 1.5], 'sequence'],
            'invalid start' => [['timecode_start' => 'abc'], 'timecode_start'],
            'backward timecodes' => [['timecode_start' => '00:27:06', 'timecode_end' => '00:26:58'], 'timecode_end'],
            'one timecode' => [['timecode_end' => null], 'timecode_end'],
            'oversized UTF-8 source' => [['source_text' => str_repeat('あ', 22000)], 'source_text'],
            'empty source' => [['source_text' => '  '], 'source_text'],
            'missing source' => [['source_text' => null], 'source_text'],
            'invalid status' => [['status' => 'translated'], 'status'],
            'complete without translation' => [['status' => 'completed'], 'final_translation'],
            'AI output input' => [['ai_translation' => 'untrusted'], 'ai_translation'],
            'script override' => [['script_id' => 999], 'script_id'],
        ];
    }

    #[DataProvider('invalidInputs')]
    public function test_validation_blocks_bad_creates_and_updates(array $overrides, string $field): void {
        $segment = Segment::factory()->create();
        $this->actingAs($segment->script->project->user, 'web');
        $base = "/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}/segments";
        $this->postJson($base, $this->payload($overrides))->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson("$base/{$segment->id}", $this->payload(['version' => 1, ...$overrides]))->assertUnprocessable()->assertJsonValidationErrors($field);
    }

    public function test_stale_version_cannot_overwrite_a_saved_translation(): void {
        $segment = Segment::factory()->create();
        $this->actingAs($segment->script->project->user, 'web');
        $url = "/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}/segments/{$segment->id}";
        $this->putJson($url, $this->payload(['version' => 1, 'final_translation' => '保存済み', 'status' => 'editing']))->assertOk();
        $this->putJson($url, $this->payload(['version' => 1, 'final_translation' => '古いタブの内容', 'status' => 'editing']))->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->getJson($url)->assertJsonPath('data.final_translation', '保存済み');
    }

    public function test_source_changes_need_reconfirmation_and_recalculate_words(): void {
        $segment = Segment::factory()->create(['source_text' => 'One two', 'final_translation' => '訳', 'final_source_version' => 1, 'status' => 'completed']);
        $this->actingAs($segment->script->project->user, 'web');
        $url = "/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}/segments/{$segment->id}";
        $updated = $this->putJson($url, $this->payload(['version' => 1, 'source_text' => 'One two three', 'final_translation' => '訳', 'status' => 'completed']))->assertOk()->json('data');
        $this->assertSame(2, $updated['source_version']);
        $this->assertSame(1, $updated['final_source_version']);
        $this->assertSame('editing', $updated['status']);
        $this->getJson("/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}")->assertJsonPath('data.word_count', 3)->assertJsonPath('data.progress.completed', 0);
        $this->putJson($url, $this->payload(['version' => 2, 'source_text' => 'One two three', 'final_translation' => '訳', 'status' => 'completed']))->assertJsonPath('data.final_source_version', 2)->assertJsonPath('data.status', 'completed');
    }

    public function test_script_and_project_deletions_hide_descendants(): void {
        $segment = Segment::factory()->create();
        $this->actingAs($segment->script->project->user, 'web');
        $this->deleteJson("/api/projects/{$segment->script->project_id}/scripts/{$segment->script_id}")->assertNoContent();
        $this->assertSoftDeleted('segments', ['id' => $segment->id]);
        $another = Segment::factory()->for(Script::factory()->for($segment->script->project))->create();
        $this->deleteJson("/api/projects/{$segment->script->project_id}")->assertNoContent();
        $this->assertSoftDeleted('segments', ['id' => $another->id]);
    }
}
