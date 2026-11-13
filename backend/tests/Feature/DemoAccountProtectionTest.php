<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

class DemoAccountProtectionTest extends \Tests\TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'email' => 'owner@example.com',
            'role' => 'admin',
            'password' => Hash::make('Owner123!'),
        ]);
    }

    private function demo(string $email, string $role): User
    {
        return User::factory()->create([
            'email' => $email,
            'role' => $role,
            'password' => Hash::make('Demo123!'),
        ]);
    }

    public function test_demo_account_email_password_and_role_cannot_be_changed()
    {
        Sanctum::actingAs($this->admin());
        $demo = $this->demo('cashier@example.com', 'cashier');

        $this->patchJson("/api/users/{$demo->id}", ['email' => 'changed@example.com'])
            ->assertStatus(422);
        $this->patchJson("/api/users/{$demo->id}", ['password' => 'NewPassword123!'])
            ->assertStatus(422);
        $this->patchJson("/api/users/{$demo->id}", ['role' => 'admin'])
            ->assertStatus(422);

        // Nama tetap boleh diperbarui; hanya kredensial dan peran yang dikunci.
        $this->patchJson("/api/users/{$demo->id}", ['name' => 'Kasir Demo'])
            ->assertStatus(200);
    }

    public function test_demo_account_cannot_be_deleted()
    {
        Sanctum::actingAs($this->admin());
        $demo = $this->demo('kitchen@example.com', 'kitchen');

        $this->deleteJson("/api/users/{$demo->id}")->assertStatus(422);
        $this->assertDatabaseHas('users', ['id' => $demo->id]);
    }

    public function test_logout_only_revokes_current_token()
    {
        $admin = $this->admin();
        $first = $admin->createToken('first')->plainTextToken;
        $second = $admin->createToken('second')->plainTextToken;

        $this->withHeader('Authorization', "Bearer $first")
            ->postJson('/api/logout')
            ->assertStatus(200);

        app('auth')->forgetGuards();
        $this->withHeader('Authorization', "Bearer $second")
            ->getJson('/api/me')
            ->assertStatus(200);

        app('auth')->forgetGuards();
        $this->withHeader('Authorization', "Bearer $first")
            ->getJson('/api/me')
            ->assertStatus(401);
    }
}
